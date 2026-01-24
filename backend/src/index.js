import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import formRoutes from '../src/routes/formRoutes.js';
import authRoutes from '../src/routes/authRoutes.js';
import competitionRoutes from '../src/routes/competitionRoutes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

dotenv.config();

const app = express();

// CORS - FIRST middleware
app.use(cors({
  origin: '*', // Allow all origins temporarily to test
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Explicitly handle OPTIONS
app.options('*', cors());

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/forms', formRoutes);

// Error handling
app.use(errorHandler);

export default app;