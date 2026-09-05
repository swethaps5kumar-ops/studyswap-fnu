// admin.js - admin-only user management: approve, add, remove.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

const SAFE_USER_COLUMNS = 'id, first_name, last_name, email, role, is_verified, is_approved, created_at';

// List students who verified their email but still need admin approval to log in.
router.get('/pending', (req, res) => {
  const rows = db.prepare(`
    SELECT ${SAFE_USER_COLUMNS} FROM users WHERE is_verified = 1 AND is_approved = 0 ORDER BY created_at ASC
  `).all();
  res.json({ users: rows });
});

// List every user (for the "All users" admin tab).
router.get('/users', (req, res) => {
  const rows = db.prepare(`SELECT ${SAFE_USER_COLUMNS} FROM users ORDER BY created_at DESC`).all();
  res.json({ users: rows });
});

// Approve a pending registration so the student can log in.
router.post('/approve/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  db.prepare('UPDATE users SET is_approved = 1 WHERE id = ?').run(user.id);
  res.json({ message: `${user.first_name} ${user.last_name} approved.` });
});

// Revoke approval (e.g. suspend a student without deleting them).
router.post('/revoke/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  db.prepare('UPDATE users SET is_approved = 0 WHERE id = ?').run(user.id);
  res.json({ message: `${user.first_name} ${user.last_name}'s access was revoked.` });
});

// Admin manually adds a user - skips OTP, auto verified + approved.
router.post('/users', async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'A user with this email already exists.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const finalRole = role === 'admin' ? 'admin' : 'student';

  const info = db.prepare(`
    INSERT INTO users (first_name, last_name, email, password_hash, role, is_verified, is_approved, created_at)
    VALUES (?, ?, ?, ?, ?, 1, 1, ?)
  `).run(firstName, lastName, email.toLowerCase(), passwordHash, finalRole, Date.now());

  res.status(201).json({ message: 'User added.', id: info.lastInsertRowid });
});

// Remove a user entirely (and clean up their listings/messages).
router.delete('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (req.session.user.id === user.id) return res.status(400).json({ error: "You can't remove your own account." });

  const listingIds = db.prepare('SELECT id FROM listings WHERE seller_id = ?').all(user.id).map(l => l.id);
  for (const id of listingIds) {
    db.prepare('DELETE FROM messages WHERE listing_id = ?').run(id);
  }
  db.prepare('DELETE FROM listings WHERE seller_id = ?').run(user.id);
  db.prepare('DELETE FROM messages WHERE buyer_id = ?').run(user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  res.json({ message: `${user.first_name} ${user.last_name} removed.` });
});

module.exports = router;
