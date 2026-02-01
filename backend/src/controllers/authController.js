import { db } from '../config/firebase.js';
import { auth } from '../config/firebase.js';

// Logic for creating a new user
export const signup = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    
    const userRecord = await auth.createUser({
      email,
      password,
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

// Logic for verifying a token
export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    res.json({
      uid: decodedToken.uid,
      email: decodedToken.email,
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const getAdminEmails = async (req, res) => {
  try {
    // Query Firestore for users where the role is 'admin'
    const adminsSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .get();

    if (adminsSnapshot.empty) {
      return res.status(200).json([]);
    }

    // Extract just the emails
    const adminEmails = adminsSnapshot.docs.map(doc => doc.data().email);

    res.status(200).json(adminEmails);
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};