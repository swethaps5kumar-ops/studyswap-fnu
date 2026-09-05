// seedAdmin.js - run once with "npm run seed-admin" to create/update the admin account
// using the ADMIN_* values in your .env file.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function main() {
  const firstName = process.env.ADMIN_FIRST_NAME || 'Site';
  const lastName = process.env.ADMIN_LAST_NAME || 'Admin';
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file first.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (existing) {
    db.prepare(`
      UPDATE users SET first_name = ?, last_name = ?, password_hash = ?, role = 'admin', is_verified = 1, is_approved = 1
      WHERE id = ?
    `).run(firstName, lastName, passwordHash, existing.id);
    console.log(`Updated existing admin account: ${email}`);
  } else {
    db.prepare(`
      INSERT INTO users (first_name, last_name, email, password_hash, role, is_verified, is_approved, created_at)
      VALUES (?, ?, ?, ?, 'admin', 1, 1, ?)
    `).run(firstName, lastName, email, passwordHash, Date.now());
    console.log(`Created admin account: ${email}`);
  }
  process.exit(0);
}

main();
