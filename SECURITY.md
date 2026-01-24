# Security Checklist for Deployment

Complete this checklist before deploying to production.

## Environment Configuration

- [ ] All `.env` files are in `.gitignore` (never commit secrets)
- [ ] `.env.example` files contain only placeholder values
- [ ] `serviceAccountKey.json` is in `.gitignore`
- [ ] Firebase service account credentials are stored securely

## Backend Security

- [ ] `API_KEY` is a strong, random string (use a password generator)
- [ ] `FRONTEND_URL` is set to the exact deployed frontend URL
- [ ] CORS is configured to only accept requests from your frontend
- [ ] Health check endpoint (`/health`) is working
- [ ] Rate limiting is enabled (100 requests/minute default)
- [ ] API key validation is enforced on all routes except `/health`

## Frontend Security

- [ ] `VITE_FIREBASE_API_KEY` is a public Firebase API key (not sensitive)
- [ ] `VITE_API_KEY` matches backend `API_KEY` exactly
- [ ] `VITE_API_URL` points to your deployed backend domain
- [ ] Firebase client config contains only public values
- [ ] No sensitive data is stored in local storage
- [ ] HTTPS is enforced (Vercel provides this automatically)

## Firebase Configuration

- [ ] Firebase Authentication is enabled
- [ ] Firestore security rules restrict access properly
  - [ ] Authenticated users can only read/write their own data
  - [ ] Admin operations are restricted to admin users
  - [ ] Public reads are disabled unless necessary
- [ ] Service account key has minimal required permissions
- [ ] Firebase API keys are restricted to specific domains (optional but recommended)

## Vercel Deployment

### Backend Project

- [ ] Environment variables are set in Vercel project settings:
  - [ ] `NODE_ENV=production`
  - [ ] `FIREBASE_PROJECT_ID`
  - [ ] `API_KEY`
  - [ ] `FRONTEND_URL`
  - [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` (as file variable)
- [ ] Health check is configured (Settings → Health Checks)
- [ ] Vercel logs show successful deployments
- [ ] Test endpoint: `GET /health` returns `{ "status": "ok" }`

### Frontend Project

- [ ] Environment variables are set in Vercel project settings:
  - [ ] `VITE_FIREBASE_API_KEY`
  - [ ] `VITE_FIREBASE_AUTH_DOMAIN`
  - [ ] `VITE_FIREBASE_PROJECT_ID`
  - [ ] `VITE_API_URL` (updated to backend URL)
  - [ ] `VITE_API_KEY` (matches backend)
- [ ] Build succeeds without errors
- [ ] App loads and connects to backend successfully

## Testing

- [ ] Frontend loads without console errors
- [ ] Authentication flow works (signup/login)
- [ ] API requests include `X-API-Key` header
- [ ] CORS errors do not appear
- [ ] Invalid API key returns 403 Forbidden
- [ ] Rate limiting works (test by sending many requests)
- [ ] Database operations work (read/write to Firestore)
- [ ] Deployed app responds within reasonable time

## Monitoring & Logs

- [ ] Vercel logs are accessible for both projects
- [ ] Error handling is working (errors logged, not exposed to client)
- [ ] No sensitive data appears in logs
- [ ] Performance is acceptable (page load time, API response time)

## Security Headers

- [ ] Content-Security-Policy headers are set (if using Express middleware)
- [ ] X-Frame-Options is set to DENY (if needed)
- [ ] X-Content-Type-Options is set to nosniff

Example Express middleware to add:

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
```

## Regular Maintenance

- [ ] Review Firebase security rules quarterly
- [ ] Rotate API keys periodically
- [ ] Check Vercel logs for suspicious activity
- [ ] Update dependencies regularly
- [ ] Monitor Firestore usage and costs

## API Key Rotation

When rotating the API key:

1. Generate a new strong random string
2. Update backend `API_KEY` in Vercel environment variables
3. Update frontend `VITE_API_KEY` in Vercel environment variables
4. Trigger redeployment of both projects
5. Wait for deployments to complete
6. Test API requests work
7. Document the rotation in your records

## Incident Response

If credentials are compromised:

1. **Immediately** revoke the compromised credentials
2. Generate new API keys
3. Update all deployments
4. Review Vercel logs for unauthorized access
5. Rotate Firebase credentials if needed
6. Monitor for unusual database activity

## Documentation

- [ ] README.md is updated
- [ ] DEPLOYMENT.md is current and accurate
- [ ] DEVELOPMENT.md has clear setup instructions
- [ ] Team members know where to find deployment docs
- [ ] Handoff documentation for new team members exists

## Questions?

- Check DEPLOYMENT.md for deployment issues
- Check DEVELOPMENT.md for local setup issues
- Review Vercel documentation: https://vercel.com/docs
- Review Firebase documentation: https://firebase.google.com/docs
