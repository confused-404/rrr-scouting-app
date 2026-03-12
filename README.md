# rrr scouting app

# MY VIBE CODING EXPERIMENT

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

## Password reset workflow

A forgot‑password link on the login form lets users request a temporary code by
email. The backend generates a six‑digit code stored in Firestore and sends it
via SMTP; the user submits that code along with their new password in order to
complete the reset.  To enable this feature you must provide SMTP credentials
in the backend environment (see `.env.example`).

> 🛠 **Local development tip:**
>
> * Make sure your SMTP credentials live in the file that gets loaded by
>   backend/loadEnv.js (`.env.local` in development).  The loader uses
>   `dotenv.config({ path: ".env.local" })`, so putting them in `necessary.env`
>   or `.env` alone won’t help in dev.
> * If you see an error such as `ECONNREFUSED 127.0.0.1:587` or `::1:587`, it
>   means `EMAIL_HOST` was blank and nodemailer fell back to localhost.
> * You can use Mailtrap, SendGrid, Gmail SMTP, etc. for testing; Mailtrap’s
>   settings are convenient because they don’t require a real inbox.
> * Regardless of provider, add the variables below to the appropriate
>   env file before restarting the server:
>
> ```env
> EMAIL_HOST=smtp.example.com
> EMAIL_PORT=587
> EMAIL_SECURE=false
> EMAIL_USER=your@address
> EMAIL_PASS=yourpassword
> EMAIL_FROM="Scouting App <no-reply@yourdomain.com>"
> ```
>
> * If SMTP still isn’t available, the reset code is logged to the console so
>   you can copy it manually and complete the flow without email.
> * Alternatively, set `BREVO_API_KEY` instead of the SMTP variables; the
>   mailer will automatically use Brevo's REST API.

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

```
