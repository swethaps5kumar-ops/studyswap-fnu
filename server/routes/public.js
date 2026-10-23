// public.js - read-only listing data for the homepage (no login needed).
// Only safe fields are returned: no seller email, no chat data.
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/listings', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    rows = db.prepare(`
      SELECT l.id, l.title, l.price, l.status, l.image, u.first_name AS seller_first_name
      FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE LOWER(l.title) LIKE ? OR LOWER(l.keywords) LIKE ? OR LOWER(l.description) LIKE ?
      ORDER BY l.created_at DESC LIMIT 12
    `).all(like, like, like);
  } else {
    rows = db.prepare(`
      SELECT l.id, l.title, l.price, l.status, l.image, u.first_name AS seller_first_name
      FROM listings l JOIN users u ON u.id = l.seller_id
      ORDER BY l.created_at DESC LIMIT 12
    `).all();
  }
  res.json({ listings: rows });
});

module.exports = router;
