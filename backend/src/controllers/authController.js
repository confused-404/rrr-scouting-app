import { auth, db } from '../config/firebase.js';

// Create a new user and initialize their profile in Firestore
export const signup = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    
    // 1. Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
    });

    // 2. Create user document in Firestore (default role is 'user')
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      role: 'user',
      createdAt: new Date().toISOString()
    });
    
    res.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ message: error.message });
  }
};

// Verify token and return user data
export const getMe = async (req, res) => {
  try {
    // req.user is populated by the verifyToken middleware
    res.json({
      uid: req.user.uid,
      email: req.user.email,
      admin: !!req.user.admin // boolean check for the admin claim
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Promote a user to Admin using Custom Claims API
export const makeAdmin = async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ message: 'User UID required' });
    }

    // 1. Set Custom Claim on the Auth token (For Route Security)
    await auth.setCustomUserClaims(uid, { admin: true });

    // 2. Update Firestore (For Database Queries/Listing)
    await db.collection('users').doc(uid).update({
      role: 'admin'
    });

    res.json({ message: `User ${uid} successfully promoted to Admin.` });
  } catch (error) {
    console.error('Error setting custom claims:', error);
    res.status(500).json({ message: error.message });
  }
};

// Query Firestore for all users with the 'admin' role
export const getAdminEmails = async (req, res) => {
  try {
    const adminsSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .get();

    const adminEmails = adminsSnapshot.docs.map(doc => doc.data().email);
    res.status(200).json(adminEmails);
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};