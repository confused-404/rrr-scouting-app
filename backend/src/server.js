import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import formRoutes from './routes/formRoutes.js';
import authRoutes from './routes/authRoutes.js';
import competitionRoutes from './routes/competitionRoutes.js'; // Add this
import { errorHandler } from './middleware/errorHandler.js';
import { validateApiKey, rateLimit } from './middleware/apiAuth.js';
import { db } from './config/firebase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Only allow requests from specified frontend
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(rateLimit(100, 60000)); // 100 requests per minute
app.use(validateApiKey);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/forms', formRoutes);

// Error handling
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server started on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default server;