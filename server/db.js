// db.js - sets up the SQLite database and creates tables if they don't exist yet.
// Uses Node's built-in SQLite module (no native compiling/build tools needed).
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, '..', 'data.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',      -- 'student' or 'admin'
    otp TEXT,
    otp_expires INTEGER,
    is_verified INTEGER NOT NULL DEFAULT 0,    -- email OTP confirmed
    is_approved INTEGER NOT NULL DEFAULT 0,    -- admin approved the account
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    keywords TEXT,
    status TEXT NOT NULL DEFAULT 'available',  -- 'available' | 'reserved' | 'sold'
    reserved_by INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,      -- identifies which buyer-seller thread this belongs to
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(listing_id) REFERENCES listings(id)
  );
`);

// Migration: add the "image" column for databases created before photos were supported.
// Safe to run every time the server starts - if the column already exists, this just
// throws (caught below) and nothing changes.
try {
  db.exec("ALTER TABLE listings ADD COLUMN image TEXT");
} catch (err) {
  // Column already exists - nothing to do.
}

module.exports = db;
