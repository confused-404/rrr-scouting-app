# Local Development Setup

Follow these steps to set up the project for local development.

## Prerequisites

- Node.js 20.19.6 or higher
- npm or yarn
- Firebase project with Firestore and Authentication enabled
- Service account key from Firebase (for backend)

## 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd rrr-scouting-app

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

## 2. Firebase Setup

### Get Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (⚙️ icon)
4. Create a service account key:
   - Click "Service Accounts" tab
   - Click "Generate New Private Key"
   - Save it as `backend/serviceAccountKey.json` (keep this file private!)

### Get Firebase Client Config

1. In Project Settings, go to "General" tab
2. Under "Your apps", find your web app
3. Copy the Firebase config values

## 3. Configure Environment Variables

### Backend

Create `backend/.env`:

```env
NODE_ENV=development
FIREBASE_PROJECT_ID=your-firebase-project-id
API_KEY=dev-key-for-local-testing
FRONTEND_URL=http://localhost:3000
PORT=3001
```

Copy your Firebase project ID into `FIREBASE_PROJECT_ID`.

### Frontend

Create `frontend/.env.local`:

```env
VITE_FIREBASE_API_KEY=your-web-app-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_API_URL=http://localhost:3001
```

Get these values from your Firebase project settings (web app config).

## 4. Run the Application

### Terminal 1 - Backend

```bash
cd backend
npm run dev
```

Expected output:
```
[timestamp] Server started on port 3001
Environment: development
```

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
```

## 5. Verify Setup

1. Open http://localhost:3000 in your browser
2. You should see the app loaded
3. Check browser console for any errors
4. Try authenticating with Firebase

## Common Issues

### "Cannot find module 'serviceAccountKey.json'"

**Solution**: Make sure you've downloaded the service account key from Firebase and saved it to `backend/serviceAccountKey.json`.

### "CORS error" when making API requests

**Solution**: 
- Ensure backend is running on port 3001
- Check that `FRONTEND_URL` in backend `.env` is `http://localhost:3000`
- Restart the backend server after changing env vars

### Firebase authentication not working

**Solution**:
- Verify `VITE_FIREBASE_*` values in `frontend/.env.local` match your Firebase project
- Enable Authentication method in Firebase Console (Email/Password, Google, etc.)
- Check Firebase security rules allow the operation

### API returns 401 Unauthorized

**Solution**:
- Check `API_KEY` in backend `.env`
- Verify frontend is sending the same API key in requests
- Check browser Network tab to see request headers

## Development Scripts

### Backend

```bash
npm run dev    # Start development server with auto-reload
npm start      # Run production build
npm run lint   # Run linter (if configured)
```

### Frontend

```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

## Database Setup

No additional setup needed for Firestore if your Firebase project is already configured. However:

1. Ensure your Firebase project has Firestore enabled
2. Set appropriate security rules in Firebase Console
3. Create any necessary collections in Firestore

Example basic security rule for development (⚠️ not for production):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Project Structure for Development

```
.
├── backend/
│   ├── src/
│   │   ├── server.js           # Main server file
│   │   ├── config/firebase.js   # Firebase setup
│   │   ├── routes/              # API routes
│   │   ├── controllers/         # Business logic
│   │   ├── models/              # Data models
│   │   └── middleware/          # Express middleware
│   ├── package.json
│   ├── .env                     # ⚠️ Never commit (use .env.example)
│   ├── .env.example
│   ├── serviceAccountKey.json   # ⚠️ Never commit
│   └── vercel.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/          # React components
│   │   ├── services/api.ts      # API client
│   │   ├── config/firebase.ts   # Firebase client setup
│   │   ├── contexts/            # React contexts
│   │   └── types/               # TypeScript types
│   ├── package.json
│   ├── .env.local               # ⚠️ Never commit (use .env.example)
│   ├── .env.example
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── vercel.json
├── .gitignore
├── README.md
└── DEPLOYMENT.md
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, commit
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

**Important**: Never commit `.env`, `serviceAccountKey.json`, or `node_modules/`.

## Next Steps

- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions
- Check backend/src/routes/ for API endpoint examples
- Review frontend/src/services/api.ts for API client usage
- Set up Firestore collections and security rules in Firebase Console

## Need Help?

1. Check error messages in browser console and terminal
2. Verify all environment variables are correctly set
3. Ensure Firebase project is properly configured
4. Check that both backend and frontend servers are running
5. Review DEPLOYMENT.md if issues persist
