import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import formRoutes from './routes/formRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { db } from './config/firebase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/forms', formRoutes);

// Error handling
app.use(errorHandler);

// app.get('/api/test-firestore', async (req, res) => {
//   try {
//     const snapshot = await db.collection('forms').get();
//     // console.log('Number of documents:', snapshot.size);
//     const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//     // console.log('Documents:', docs);
//     res.json({ count: snapshot.size, docs });
//   } catch (error) {
//     // console.error('Firestore test error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});