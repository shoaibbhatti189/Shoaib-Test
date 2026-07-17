/**
 * middleware/auth.js
 *
 * authenticateToken — verifies JWT and auto-attaches req.companyId:
 *   • super_admin → req.companyId = null (no scope filter → sees all)
 *   • everyone else → req.companyId = their company_id from the token
 *
 * requireRole(...roles) — assert the user has one of the given roles.
 *   Used in Phase 1; replaced by can() from permissions.js in Phase 2.
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token)
    return res.status(401).json({ error: 'No token provided. Please log in.' });

  jwt.verify(token, SECRET, (err, user) => {
    if (err)
      return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });

    req.user = user;

    // ── Company scoping ───────────────────────────────────────────
    // Fold scopeToCompany logic here so it can never be forgotten.
    if (user.role === 'super_admin') {
      // Super admin bypasses company scope.
      // Optionally accepts ?company_id query param to filter a specific company.
      req.companyId = req.query.company_id || null;
    } else {
      if (!user.company_id) {
        return res.status(403).json({
          error: 'Your account has no company assigned. Contact a super admin.'
        });
      }
      req.companyId = user.company_id;
    }

    next();
  });
};

/**
 * requireRole(...roles)
 * Returns 403 if req.user.role is not one of the given roles.
 * Phase 1 guard — Phase 2 replaces per-route usage with can().
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: 'Not authenticated.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required: ${roles.join(' or ')}. Your role: ${req.user.role}.`
      });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };
