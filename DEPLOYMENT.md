# Vercel Deployment Guide

This application is set up for separate deployment of backend and frontend to Vercel.

## Deployment Architecture

- **Backend**: Express.js API deployed as a Vercel serverless function
- **Frontend**: React + Vite SPA deployed as static files
- **Security**: API key validation between frontend and backend
- **Database**: Firebase (Firestore/Auth)

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Firebase Project**: With Firestore and Authentication enabled
3. **Service Account Key**: For backend Firebase admin access
4. **Git**: Repository must be pushed to GitHub

## Environment Variables

### Backend Environment Variables

Set these in Vercel project settings:

```
NODE_ENV=production
FIREBASE_PROJECT_ID=your-firebase-project-id
API_KEY=your-secure-random-api-key-here
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

**Important**: The `API_KEY` is a secret shared between frontend and backend for API authentication. Generate a strong random string.

### Frontend Environment Variables

Set these in Vercel project settings:

```
VITE_FIREBASE_API_KEY=your-firebase-public-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_API_URL=https://your-backend-domain.vercel.app
```

**Note**: Frontend environment variables starting with `VITE_` are publicly exposed and should NOT contain secrets.

## Deployment Steps

### 1. Deploy Backend

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. **Root Directory**: Set to `backend`
5. **Environment Variables**: Add all backend variables (see above)
6. Add `serviceAccountKey.json` file:
   - In Project Settings → Environment Variables
   - Add as a "File" type variable named `FIREBASE_SERVICE_ACCOUNT_KEY`
   - Paste contents of your Firebase service account JSON
7. Click "Deploy"
8. Copy the deployment URL (e.g., `https://your-backend-project.vercel.app`)

### 2. Deploy Frontend

1. In Vercel Dashboard, click "New Project" again
2. Import the same GitHub repository
3. **Root Directory**: Set to `frontend`
4. **Environment Variables**:
   - Add all frontend variables from above
   - Use the backend URL from step 1 for `VITE_API_URL`
5. Click "Deploy"

### 3. Update Backend CORS

After frontend deployment:

1. Go to backend project in Vercel
2. Settings → Environment Variables
3. Update `FRONTEND_URL` to your deployed frontend URL
4. Trigger a redeployment or manually redeploy

## Security Considerations

### API Key Authentication
- All API requests must include the `X-API-Key` header
- The frontend automatically includes this in requests
- Set a strong, random API key in environment variables
- Consider rotating it periodically

### Environment Variables
- **Public**: Frontend variables (safe to commit to `.env.example`)
- **Secret**: Backend variables (never commit `.env` or `serviceAccountKey.json`)
- Use Vercel's secure environment variable management

### CORS
- Backend only accepts requests from your frontend domain
- Update `FRONTEND_URL` when deploying to new domains

### Firebase Credentials
- Service account key is only used on the backend
- Frontend uses Firebase public API key (not sensitive)
- Never expose the service account key on the frontend

## Local Development

### Backend
```bash
cd backend
npm install
echo "NODE_ENV=development
FIREBASE_PROJECT_ID=your-project-id
API_KEY=dev-key
FRONTEND_URL=http://localhost:3000" > .env

npm run dev
```

### Frontend
```bash
cd frontend
npm install
echo "VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_API_URL=http://localhost:3001" > .env.local

npm run dev
```

## Monitoring

### Health Checks
Backend provides a health endpoint:
- **Endpoint**: `GET /health`
- **No authentication required**
- **Response**: `{ "status": "ok" }`

Use this in Vercel project settings for monitoring.

## Troubleshooting

### 401 Unauthorized
- Check that `X-API-Key` header is present in requests
- Verify `API_KEY` environment variable in backend

### 403 Forbidden
- Verify the API key matches between frontend and backend
- Check backend's `FRONTEND_URL` CORS setting

### 500 Internal Server Error
- Check Vercel logs: Click project → "Deployments" → click deployment → "View Logs"
- Verify Firebase credentials and `serviceAccountKey.json` is correctly set
- Ensure all required environment variables are set

### Firebase Connection Issues
- Verify `FIREBASE_PROJECT_ID` is correct
- Ensure service account has correct Firestore/Auth permissions
- Check Firebase project security rules allow the operations

## File Structure

```
.
├── backend/
│   ├── src/
│   │   ├── server.js (no localhost)
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   │   ├── apiAuth.js (new)
│   │   │   └── errorHandler.js
│   │   └── models/
│   ├── package.json
│   ├── .env.example
│   └── vercel.json
├── frontend/
│   ├── src/
│   │   ├── services/api.ts (uses env vars)
│   │   ├── config/
│   │   ├── components/
│   │   └── ...
│   ├── package.json
│   ├── .env.example
│   ├── vite.config.ts (no localhost proxy)
│   └── vercel.json
├── .env.example
├── .gitignore
└── DEPLOYMENT.md
```

## Additional Resources

- [Vercel Node.js Documentation](https://vercel.com/docs/concepts/functions/serverless-functions/node.js)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-modes.html)
- [Express CORS Middleware](https://expressjs.org/en/resources/middleware/cors.html)

## Support

For issues:
1. Check Vercel deployment logs
2. Verify all environment variables are set
3. Ensure service account key has correct permissions
4. Test backend health endpoint: `GET /health`
