# rrr scouting app

**Node.js version**: 20.19.6

## Development

### Quick Start

```
# Terminal 1 - Backend
cd backend
npm i
npm run dev

# Terminal 2 - Frontend
cd frontend
npm i
npm run dev
```

Backend runs on `http://localhost:3001` (or `$PORT`)
Frontend runs on `http://localhost:3000`

### Setup Environment Variables

Create `.env` files in each directory using `.env.example` as a template:

```
# Backend
cd backend && cp .env.example .env

# Frontend
cd frontend && cp .env.example .env.local
```

## Deployment

This app is configured for separate deployment to Vercel:
- Backend as serverless functions
- Frontend as static SPA
- Secure API key authentication between them

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.**

## Project Structure

```
.
├── backend/          # Express API
│   ├── src/
│   ├── vercel.json
│   └── .env.example
├── frontend/         # React + Vite
│   ├── src/
│   ├── vercel.json
│   └── .env.example
└── DEPLOYMENT.md     # Deployment guide
```

## Features

- Firebase Authentication
- Firestore Database
- Role-based access (Admin/User)
- Form management
- Competition management
- Production-ready security (API key auth, CORS, rate limiting)
