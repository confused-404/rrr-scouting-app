import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import formRoutes from '../src/routes/formRoutes.js';
import authRoutes from '../src/routes/authRoutes.js';
import competitionRoutes from '../src/routes/competitionRoutes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validateApiKey, rateLimit } from '../src/middleware/apiAuth.js';

dotenv.config();

const app = express();

// CORS configuration - MUST be before other middleware
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://rrr-scouting.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

// Apply rate limiting AFTER CORS
app.use(rateLimit(100, 60000));

// Apply API key validation AFTER CORS
app.use(validateApiKey);

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/forms', formRoutes);

// Error handling
app.use(errorHandler);

// Export the app for Vercel
export default app;