// auth.js - route guards based on the session set at login.
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'You must be logged in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only.' });
  }
  next();
}

function requireStudent(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.status(403).json({ error: 'Students only.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireStudent };
