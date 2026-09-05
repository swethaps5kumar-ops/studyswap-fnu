// auth.js - registration, OTP verification, login, logout.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateOtp, otpExpiryTimestamp, isOtpExpired } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailAllowed(email) {
  const domain = process.env.STUDENT_EMAIL_DOMAIN;
  if (!domain) return true; // no restriction configured
  return email.toLowerCase().endsWith(domain.toLowerCase());
}

// ---- Register ----
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, student email, and password are all required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!emailAllowed(email)) {
    return res.status(400).json({ error: `Please register using your student email (${process.env.STUDENT_EMAIL_DOMAIN}).` });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

  if (existing && existing.is_verified && existing.is_approved) {
    return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
  }

  const otp = generateOtp();
  const otpExpires = otpExpiryTimestamp(10);
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    // Re-registering before finishing verification/approval: refresh their details + OTP.
    db.prepare(`
      UPDATE users SET first_name = ?, last_name = ?, password_hash = ?, otp = ?, otp_expires = ?, is_verified = 0
      WHERE id = ?
    `).run(firstName, lastName, passwordHash, otp, otpExpires, existing.id);
  } else {
    db.prepare(`
      INSERT INTO users (first_name, last_name, email, password_hash, role, otp, otp_expires, is_verified, is_approved, created_at)
      VALUES (?, ?, ?, ?, 'student', ?, ?, 0, 0, ?)
    `).run(firstName, lastName, email.toLowerCase(), passwordHash, otp, otpExpires, Date.now());
  }

  try {
    await sendOtpEmail(email, firstName, otp);
  } catch (err) {
    console.error('Failed to send OTP email:', err.message);
    return res.status(500).json({ error: 'Could not send the verification email. Please try again shortly.' });
  }

  res.json({ message: 'Verification code sent to your student email.', email: email.toLowerCase() });
});

// ---- Verify OTP ----
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and code are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No registration found for that email.' });
  if (user.is_verified) return res.status(400).json({ error: 'This account is already verified.' });
  if (isOtpExpired(user.otp_expires)) return res.status(400).json({ error: 'That code expired. Please request a new one.' });
  if (user.otp !== String(otp).trim()) return res.status(400).json({ error: 'Incorrect code.' });

  db.prepare('UPDATE users SET is_verified = 1, otp = NULL, otp_expires = NULL WHERE id = ?').run(user.id);

  res.json({ message: 'Email verified! Your account now needs admin approval before you can log in.' });
});

// ---- Resend OTP ----
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'No registration found for that email.' });
  if (user.is_verified) return res.status(400).json({ error: 'This account is already verified.' });

  const otp = generateOtp();
  const otpExpires = otpExpiryTimestamp(10);
  db.prepare('UPDATE users SET otp = ?, otp_expires = ? WHERE id = ?').run(otp, otpExpires, user.id);

  try {
    await sendOtpEmail(user.email, user.first_name, otp);
  } catch (err) {
    console.error('Failed to resend OTP email:', err.message);
    return res.status(500).json({ error: 'Could not send the verification email. Please try again shortly.' });
  }

  res.json({ message: 'A new code has been sent.' });
});

// ---- Login ----
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Incorrect email or password.' });

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) return res.status(401).json({ error: 'Incorrect email or password.' });

  if (user.role === 'student') {
    if (!user.is_verified) return res.status(403).json({ error: 'Please verify your email with the code we sent you first.' });
    if (!user.is_approved) return res.status(403).json({ error: 'Your account is awaiting admin approval.' });
  }

  req.session.user = {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
  };

  res.json({ message: 'Logged in.', user: req.session.user });
});

// ---- Logout ----
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

// ---- Current session ----
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ user: req.session.user });
});

module.exports = router;
