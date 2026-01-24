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

// CORS configuration - must be FIRST
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

// Explicitly handle preflight
app.options('*', cors(corsOptions));

app.use(express.json());

// Apply rate limiting and API key validation AFTER CORS
app.use(rateLimit(100, 60000)); // 100 requests per minute
app.use(validateApiKey);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/forms', formRoutes);

// Error handling
app.use(errorHandler);

// Export for Vercel serverless
export default app;