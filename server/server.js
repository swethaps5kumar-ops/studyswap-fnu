// server.js - app entry point: middleware, routes, static frontend.
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const listingsRoutes = require('./routes/listings');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY === 'true',
  },
}));

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/chat', chatRoutes);

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`StudySwap FNU running on http://localhost:${PORT}`);
});
