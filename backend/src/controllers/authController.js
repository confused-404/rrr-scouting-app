import { auth, db } from '../config/firebase.js';
import admin from 'firebase-admin';
import { sendMail } from '../config/mailer.js';

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
    await auth.setCustomUserClaims(user.uid, { admin: true });

    // 3. Update Firestore to store the role permanently
    await db.collection('users').doc(user.uid).set({
      email: user.email,
      role: 'admin',
      updatedAt: new Date().toISOString()
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
    
    // API Call: Set the custom claim
    await auth.setCustomUserClaims(uid, { admin: true });
    
    // Database Update
    await db.collection('users').doc(uid).update({ role: 'admin' });
    
    res.json({ message: `User ${uid} promoted to admin.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET ME & GET ADMIN EMAILS
 */
export const getMe = async (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email,
    admin: !!req.user.admin
  });
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