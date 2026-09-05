// chat.js - simple per-listing chat between a buyer and the seller.
// Threads are keyed by (listing_id, buyer_id) so a seller can have separate
// conversations with different interested buyers about the same item.
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function getListingOr404(id, res) {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
  if (!listing) res.status(404).json({ error: 'Listing not found.' });
  return listing;
}

// Seller-only: list every buyer thread for one of their listings.
router.get('/:listingId/threads', (req, res) => {
  const listing = getListingOr404(req.params.listingId, res);
  if (!listing) return;
  if (listing.seller_id !== req.session.user.id) return res.status(403).json({ error: 'Only the seller can view all threads.' });

  const buyerIds = new Set(
    db.prepare('SELECT DISTINCT buyer_id FROM messages WHERE listing_id = ?').all(listing.id).map(r => r.buyer_id)
  );
  if (listing.reserved_by) buyerIds.add(listing.reserved_by);

  const threads = [...buyerIds].map(buyerId => {
    const buyer = db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(buyerId);
    const lastMsg = db.prepare(`
      SELECT * FROM messages WHERE listing_id = ? AND buyer_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(listing.id, buyerId);
    return {
      buyerId,
      buyerName: buyer ? `${buyer.first_name} ${buyer.last_name}` : 'Unknown student',
      lastMessage: lastMsg ? lastMsg.message : null,
      lastMessageAt: lastMsg ? lastMsg.created_at : null,
    };
  }).sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

  res.json({ threads });
});

// Get messages for a thread. Buyers see their own thread automatically;
// the seller must pass ?buyerId= to pick which conversation to view.
router.get('/:listingId', (req, res) => {
  const listing = getListingOr404(req.params.listingId, res);
  if (!listing) return;

  const isSeller = listing.seller_id === req.session.user.id;
  let buyerId;
  if (isSeller) {
    buyerId = Number(req.query.buyerId);
    if (!buyerId) return res.status(400).json({ error: 'buyerId is required for the seller to view a thread.' });
  } else {
    buyerId = req.session.user.id;
  }

  const messages = db.prepare(`
    SELECT m.*, u.first_name, u.last_name FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.listing_id = ? AND m.buyer_id = ?
    ORDER BY m.created_at ASC
  `).all(listing.id, buyerId);

  res.json({
    messages: messages.map(m => ({
      id: m.id,
      message: m.message,
      senderId: m.sender_id,
      senderName: `${m.first_name} ${m.last_name}`,
      createdAt: m.created_at,
      mine: m.sender_id === req.session.user.id,
    })),
  });
});

// Send a message. Buyers implicitly message the seller; the seller must
// specify which buyer thread the message belongs to.
router.post('/:listingId', (req, res) => {
  const listing = getListingOr404(req.params.listingId, res);
  if (!listing) return;

  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });

  const isSeller = listing.seller_id === req.session.user.id;
  let buyerId;
  if (isSeller) {
    buyerId = Number(req.body.buyerId);
    if (!buyerId) return res.status(400).json({ error: 'buyerId is required for the seller to reply in a thread.' });
  } else {
    buyerId = req.session.user.id;
  }

  const info = db.prepare(`
    INSERT INTO messages (listing_id, buyer_id, sender_id, message, created_at) VALUES (?, ?, ?, ?, ?)
  `).run(listing.id, buyerId, req.session.user.id, message.trim(), Date.now());

  res.status(201).json({
    message: {
      id: info.lastInsertRowid,
      message: message.trim(),
      senderId: req.session.user.id,
      senderName: `${req.session.user.firstName} ${req.session.user.lastName}`,
      createdAt: Date.now(),
      mine: true,
    },
  });
});

module.exports = router;
