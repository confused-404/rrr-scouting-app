import { auth, db } from '../config/firebase.js';

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