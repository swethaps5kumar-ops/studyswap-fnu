// listings.js - create, browse/search, reserve, and mark items sold.
const express = require('express');
const db = require('../db');
const { requireAuth, requireStudent } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function withSeller(listing) {
  const seller = db.prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ?').get(listing.seller_id);
  const reservedByUser = listing.reserved_by
    ? db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(listing.reserved_by)
    : null;
  return {
    ...listing,
    seller: seller ? { id: seller.id, name: `${seller.first_name} ${seller.last_name}`, email: seller.email } : null,
    reservedByUser: reservedByUser ? { id: reservedByUser.id, name: `${reservedByUser.first_name} ${reservedByUser.last_name}` } : null,
  };
}

// Browse / search by title or keywords. e.g. GET /api/listings?q=calculator
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    rows = db.prepare(`
      SELECT * FROM listings
      WHERE LOWER(title) LIKE ? OR LOWER(keywords) LIKE ? OR LOWER(description) LIKE ?
      ORDER BY created_at DESC
    `).all(like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM listings ORDER BY created_at DESC').all();
  }
  res.json({ listings: rows.map(withSeller) });
});

// A student's own listings ("My Listings" tab)
router.get('/mine', requireStudent, (req, res) => {
  const rows = db.prepare('SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC').all(req.session.user.id);
  res.json({ listings: rows.map(withSeller) });
});

router.get('/:id', (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  res.json({ listing: withSeller(listing) });
});

// Create a new listing for sale.
router.post('/', requireStudent, (req, res) => {
  const { title, description, price, keywords } = req.body;
  if (!title || price === undefined || price === '') {
    return res.status(400).json({ error: 'Title and price are required.' });
  }
  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ error: 'Price must be a valid non-negative number.' });
  }

  const info = db.prepare(`
    INSERT INTO listings (seller_id, title, description, price, keywords, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'available', ?)
  `).run(req.session.user.id, title.trim(), (description || '').trim(), numericPrice, (keywords || '').trim(), Date.now());

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ listing: withSeller(listing) });
});

// Buyer reserves an available item.
router.post('/:id/reserve', requireStudent, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  if (listing.seller_id === req.session.user.id) return res.status(400).json({ error: "You can't reserve your own listing." });
  if (listing.status !== 'available') return res.status(400).json({ error: 'This item is no longer available.' });

  db.prepare("UPDATE listings SET status = 'reserved', reserved_by = ? WHERE id = ?").run(req.session.user.id, listing.id);
  res.json({ listing: withSeller(db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id)) });
});

// Buyer or seller cancels a reservation, putting the item back up for sale.
router.post('/:id/cancel-reservation', requireStudent, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  const isSeller = listing.seller_id === req.session.user.id;
  const isReserver = listing.reserved_by === req.session.user.id;
  if (!isSeller && !isReserver) return res.status(403).json({ error: 'Not your reservation to cancel.' });
  if (listing.status !== 'reserved') return res.status(400).json({ error: 'This item is not currently reserved.' });

  db.prepare("UPDATE listings SET status = 'available', reserved_by = NULL WHERE id = ?").run(listing.id);
  res.json({ listing: withSeller(db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id)) });
});

// Seller marks the item sold.
router.post('/:id/sold', requireStudent, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  if (listing.seller_id !== req.session.user.id) return res.status(403).json({ error: 'Only the seller can mark this sold.' });
  if (listing.status === 'sold') return res.status(400).json({ error: 'This item is already marked sold.' });

  db.prepare("UPDATE listings SET status = 'sold' WHERE id = ?").run(listing.id);
  res.json({ listing: withSeller(db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id)) });
});

// Seller (or admin) deletes a listing.
router.delete('/:id', (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  const isOwner = listing.seller_id === req.session.user.id;
  const isAdmin = req.session.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not your listing.' });

  db.prepare('DELETE FROM messages WHERE listing_id = ?').run(listing.id);
  db.prepare('DELETE FROM listings WHERE id = ?').run(listing.id);
  res.json({ message: 'Listing deleted.' });
});

module.exports = router;
