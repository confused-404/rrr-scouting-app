import { auth, db } from '../config/firebase.js';
import admin from 'firebase-admin';
import { sendMail } from '../config/mailer.js';

const VALID_ROLES = new Set(['admin', 'drive', 'user']);

const claimsForRole = (role) => ({
  admin: role === 'admin',
  driveTeam: role === 'drive',
});

const applyRoleToUser = async (uid, role) => {
  if (!VALID_ROLES.has(role)) {
    throw new Error('Invalid role');
  }

  const userRecord = await auth.getUser(uid);
  const existingClaims = userRecord.customClaims || {};
  await auth.setCustomUserClaims(uid, {
    ...existingClaims,
    ...claimsForRole(role),
  });

  await db.collection('users').doc(uid).set({
    role,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};

/**
 * SIGNUP
 * Creates a user in Firebase Auth and pushes a 
 * corresponding document into the 'users' collection.
 */
export const signup = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    
    // Admin SDK: Create the user
    const userRecord = await auth.createUser({ email, password });

    // Admin SDK: Push into Firestore (Creates 'users' collection if it doesn't exist)
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      role: 'user',
      createdAt: new Date().toISOString()
    });
    
    res.status(201).json({ uid: userRecord.uid, email: userRecord.email });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * INITIALIZE FIRST ADMIN
 * Uses the Custom Claims API to grant admin status and 
 * updates the database so you can query admin emails.
 */
export const initializeFirstAdmin = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Get user record from the Admin SDK
    const user = await auth.getUserByEmail(email);

    // 2. USE THE API: Set custom claims for the user
    // This makes the user an admin at the security token level
    await applyRoleToUser(user.uid, 'admin');

    // 3. Keep email in Firestore for convenience
    await db.collection('users').doc(user.uid).set({
      email: user.email,
    }, { merge: true });

    res.json({ message: `Success: ${email} is now an admin and saved to DB.` });
  } catch (error) {
    console.error('Initialization error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * MAKE ADMIN (Standard Promotion)
 */
export const makeAdmin = async (req, res) => {
  try {
    const { uid } = req.body;
    await applyRoleToUser(uid, 'admin');
    
    res.json({ message: `User ${uid} promoted to admin.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ME & GET ADMIN EMAILS
 */
export const getMe = async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    const docRole = doc.exists ? doc.data().role : null;
    const role = req.user.admin
      ? 'admin'
      : (req.user.driveTeam ? 'drive' : (docRole === 'admin' || docRole === 'drive' ? docRole : 'user'));
    const scouterName = doc.exists ? (doc.data().scouterName || null) : null;
    res.json({
      uid: req.user.uid,
      email: req.user.email,
      admin: role === 'admin',
      driveTeam: role === 'drive',
      role,
      scouterName,
    });
  } catch {
    res.json({
      uid: req.user.uid,
      email: req.user.email,
      admin: !!req.user.admin,
      driveTeam: !!req.user.driveTeam,
      role: req.user.admin ? 'admin' : (req.user.driveTeam ? 'drive' : 'user'),
      scouterName: null,
    });
  }
};

/**
 * GET ALL USERS (Admin only)
 * List all Firebase Auth accounts and merge in Firestore data
 * so accounts without a Firestore doc still appear.
 */
export const getAllUsers = async (req, res) => {
  try {
    // 1. Collect every Auth account (listUsers pages up to 1000 at a time)
    const authUsers = [];
    let pageToken;
    do {
      const result = await auth.listUsers(1000, pageToken);
      authUsers.push(...result.users);
      pageToken = result.pageToken;
    } while (pageToken);

    // 2. Fetch all Firestore user docs in one shot
    const snapshot = await db.collection('users').get();
    const firestoreMap = new Map();
    snapshot.docs.forEach(doc => firestoreMap.set(doc.id, doc.data()));

    // 3. Merge: Auth is the source of truth for existence/email/role
    const users = authUsers
      .map(u => {
        const fsData = firestoreMap.get(u.uid) || {};
        const isAdmin = !!(u.customClaims?.admin) || fsData.role === 'admin';
        const isDrive = !!(u.customClaims?.driveTeam) || fsData.role === 'drive';
        const role = isAdmin ? 'admin' : (isDrive ? 'drive' : 'user');
        return {
          uid: u.uid,
          email: u.email || fsData.email || '',
          role,
          scouterName: fsData.scouterName || null,
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * UPDATE SCOUTER NAME (Admin only)
 * Links a user account to a scouter name used in the schedule.
 */
export const updateScouterName = async (req, res) => {
  try {
    const { uid } = req.params;
    const { scouterName } = req.body;
    const trimmed = typeof scouterName === 'string' ? scouterName.trim() : null;

    await db.collection('users').doc(uid).set({
      scouterName: trimmed || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    res.json({ uid, scouterName: trimmed || null });
  } catch (error) {
    console.error('Error updating scouter name:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET PINNED MATCHES (Authenticated)
 * Returns per-user pinned matches for a specific competition.
 */
export const getPinnedMatches = async (req, res) => {
  try {
    const { competitionId } = req.params;
    if (!competitionId) {
      return res.status(400).json({ message: 'competitionId is required' });
    }

    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const data = userDoc.exists ? (userDoc.data() || {}) : {};
    const byCompetition = data.pinnedMatchesByCompetition || {};
    const matches = Array.isArray(byCompetition[competitionId]) ? byCompetition[competitionId] : [];

    return res.json(matches);
  } catch (error) {
    console.error('Error fetching pinned matches:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * SAVE PINNED MATCHES (Authenticated)
 * Persists per-user pinned matches for a specific competition.
 */
export const savePinnedMatches = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const { matches } = req.body;

    if (!competitionId) {
      return res.status(400).json({ message: 'competitionId is required' });
    }

    if (!Array.isArray(matches)) {
      return res.status(400).json({ message: 'matches must be an array' });
    }

    // Sanitize payload shape and cap list size.
    const sanitized = matches
      .filter((item) => (
        item
        && typeof item.key === 'string'
        && typeof item.label === 'string'
        && Array.isArray(item.redTeams)
        && Array.isArray(item.blueTeams)
      ))
      .map((item) => ({
        key: item.key,
        label: item.label,
        redTeams: item.redTeams.map((team) => String(team)),
        blueTeams: item.blueTeams.map((team) => String(team)),
      }))
      .slice(0, 20);

    await db.collection('users').doc(req.user.uid).set({
      pinnedMatchesByCompetition: {
        [competitionId]: sanitized,
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return res.json(sanitized);
  } catch (error) {
    console.error('Error saving pinned matches:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET TEAM BANK (Authenticated)
 * Returns per-user team bank for a specific competition.
 */
export const getTeamBank = async (req, res) => {
  try {
    const { competitionId } = req.params;
    if (!competitionId) {
      return res.status(400).json({ message: 'competitionId is required' });
    }

    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const data = userDoc.exists ? (userDoc.data() || {}) : {};
    const byCompetition = data.teamBankByCompetition || {};
    const teams = Array.isArray(byCompetition[competitionId]) ? byCompetition[competitionId] : [];

    return res.json(teams);
  } catch (error) {
    console.error('Error fetching team bank:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * SAVE TEAM BANK (Authenticated)
 * Persists per-user team bank for a specific competition.
 */
export const saveTeamBank = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const { teams } = req.body;

    if (!competitionId) {
      return res.status(400).json({ message: 'competitionId is required' });
    }

    if (!Array.isArray(teams)) {
      return res.status(400).json({ message: 'teams must be an array' });
    }

    const sanitized = Array.from(new Set(
      teams
        .map((team) => String(team ?? '').trim())
        .map((team) => {
          if (!team) return '';
          if (/^frc\d+$/i.test(team)) return team.replace(/^frc/i, '');
          const digits = team.match(/\d+/)?.[0] || '';
          return digits;
        })
        .filter(Boolean),
    )).slice(0, 100);

    await db.collection('users').doc(req.user.uid).set({
      teamBankByCompetition: {
        [competitionId]: sanitized,
      },
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return res.json(sanitized);
  } catch (error) {
    console.error('Error saving team bank:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PROMOTE USER TO ADMIN (Admin only)
 */
export const promoteUser = async (req, res) => {
  try {
    const { uid } = req.params;
    if (uid === req.user.uid) {
      return res.status(400).json({ message: 'You cannot promote yourself.' });
    }
    await applyRoleToUser(uid, 'admin');
    res.json({ message: `User ${uid} promoted to admin.` });
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * DEMOTE ADMIN TO USER (Admin only)
 */
export const demoteUser = async (req, res) => {
  try {
    const { uid } = req.params;
    if (uid === req.user.uid) {
      return res.status(400).json({ message: 'You cannot demote yourself.' });
    }
    await applyRoleToUser(uid, 'user');
    res.json({ message: `User ${uid} demoted to user.` });
  } catch (error) {
    console.error('Error demoting user:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * SET USER ROLE (Admin only)
 * Supported roles: admin, drive, user
 */
export const setUserRole = async (req, res) => {
  try {
    const { uid } = req.params;
    const { role } = req.body;

    if (uid === req.user.uid) {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ message: 'Invalid role. Use admin, drive, or user.' });
    }

    await applyRoleToUser(uid, role);
    return res.json({ uid, role });
  } catch (error) {
    console.error('Error setting user role:', error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE USER (Admin only)
 * Removes user from Firebase Auth and Firestore.
 */
export const deleteUser = async (req, res) => {
  try {
    const { uid } = req.params;
    if (uid === req.user.uid) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    await auth.deleteUser(uid);
    await db.collection('users').doc(uid).delete();
    res.json({ message: `User ${uid} deleted.` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getAdminEmails = async (req, res) => {
  try {
    const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').get();
    const adminEmails = adminsSnapshot.docs.map(doc => doc.data().email);
    res.status(200).json(adminEmails);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admins' });
  }
};

/**
 * FORGOT PASSWORD
 * Generate a one‑time code, store it in Firestore with expiration,
 * and email it to the user using the configured mailer.
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // verify that user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (e) {
      // don't leak whether email exists; respond success anyway
      console.warn('forgotPassword lookup failed:', e.message);
      return res.status(200).json({ message: 'If an account exists for that email you will receive a code shortly.' });
    }

    // create a 6‑digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 1000 * 60 * 60; // one hour

    // store on user document
    await db.collection('users').doc(userRecord.uid).set({
      resetCode: code,
      resetExpires: expires
    }, { merge: true });

    // log code for development / fallback
    console.log(`password reset code for ${email}: ${code}`);

    // send email
    const text = `Your password reset code is: ${code}\n\nThis code will expire in one hour.`;
    try {
      await sendMail({
        to: email,
        subject: 'Password Reset Code',
        text
      });
    } catch (mailError) {
      console.error('mailError while sending reset code:', mailError);
      // do not fail the request; we still respond success so callers
      // cannot probe for existing accounts
    }

    res.status(200).json({ message: 'If an account exists for that email you will receive a code shortly.' });
  } catch (error) {
    console.error('forgotPassword error:', error);
    res.status(500).json({ message: 'Error generating reset code' });
  }
};

/**
 * RESET PASSWORD
 * Verify the code and expiration, then update the password via
 * the Admin SDK and clean up the temporary fields in Firestore.
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code and new password are required' });
    }

    const userRecord = await auth.getUserByEmail(email);
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const data = userDoc.data() || {};

    if (
      data.resetCode !== code ||
      !data.resetExpires ||
      data.resetExpires < Date.now()
    ) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    // update password
    await auth.updateUser(userRecord.uid, { password: newPassword });

    // remove the code fields
    await db.collection('users').doc(userRecord.uid).update({
      resetCode: admin.firestore.FieldValue.delete(),
      resetExpires: admin.firestore.FieldValue.delete()
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ message: error.message });
  }
};