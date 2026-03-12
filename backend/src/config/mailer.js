import nodemailer from 'nodemailer';

// nodemailer configuration is driven by environment variables.  You
// can use SMTP credentials from any provider (SendGrid, Mailgun,
// GMail, etc).  Example values are stored in necessary.env so that
// deployment environments also pick them up.
//
// If EMAIL_HOST is missing, the transporter will default to localhost, which
// usually results in ECONNREFUSED (as you've seen).  We'll log a warning in
// that case to make the misconfiguration obvious.

// support both EMAIL_* and SMTP_* prefixes for backwards compatibility
let HOST = process.env.EMAIL_HOST || process.env.SMTP_HOST;
let PORT = process.env.EMAIL_PORT || process.env.SMTP_PORT;
let SECURE = process.env.EMAIL_SECURE || process.env.SMTP_SECURE;
let USER = process.env.EMAIL_USER || process.env.SMTP_USER;
let PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS;
let FROM = process.env.EMAIL_FROM || process.env.SMTP_FROM;

// dotenv doesn't expand variable references like ${SMTP_HOST};
// if the value contains that pattern, manually substitute.
const resolveRef = (val) => {
  if (!val || typeof val !== 'string') return val;
  const match = val.match(/^\$\{(.+)\}$/);
  if (match) {
    return process.env[match[1]] || val;
  }
  return val;
};

HOST = resolveRef(HOST);
PORT = resolveRef(PORT);
SECURE = resolveRef(SECURE);
USER = resolveRef(USER);
PASS = resolveRef(PASS);
FROM = resolveRef(FROM);

if (!HOST) {
  console.warn('WARNING: EMAIL_HOST/SMTP_HOST is not defined; transporter will attempt localhost.');
}

// If a Brevo API key is provided we will use the REST endpoint instead of
// SMTP.  This allows users to simply drop in the single `BREVO_API_KEY`
// environment variable, which is what the OP mentioned having.

let transporter;
if (process.env.BREVO_API_KEY) {
  console.log('Brevo API key detected; using Brevo REST transport');
} else {
  transporter = nodemailer.createTransport({
    host: HOST,
    port: parseInt(PORT || '587', 10),
    secure: SECURE === 'true' || SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: USER,
      pass: PASS,
    },
  });

  // verify configuration at startup so any problems are logged immediately
  transporter.verify().then(() => {
    console.log('SMTP transporter verified successfully');
  }).catch(err => {
    console.error('SMTP transporter verification failed:', err);
    if (err && err.code === 'EAUTH') {
      console.error('SMTP authentication failed – check SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS');
      console.error('Alternatively, set BREVO_API_KEY and use the Brevo REST transport instead.');
    }
  });
}

// helper that sends via Brevo API
const sendViaBrevo = async (options) => {
  const url = 'https://api.brevo.com/v3/smtp/email';
  const payload = {
    sender: { email: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@localhost' },
    to: [{ email: options.to }],
    subject: options.subject,
    textContent: options.text,
    htmlContent: options.html,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Brevo error ${res.status}: ${JSON.stringify(data)}`);
  }
  console.log('Brevo email sent', data);
  return data;
};

export const sendMail = async (options) => {
  if (process.env.BREVO_API_KEY) {
    // use Brevo API directly
    return sendViaBrevo(options);
  }

  // fall back to SMTP transport
  const mailOptions = {
    from: FROM || USER,
    ...options,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    return info;
  } catch (err) {
    console.error('Error sending email:', err);
    throw err;
  }
};
