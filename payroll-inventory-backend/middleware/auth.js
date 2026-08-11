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
const prisma = require('../lib/prisma');

const SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token)
    return res.status(401).json({ error: 'No token provided. Please log in.' });

  try {
    const decoded = jwt.verify(token, SECRET);
    
    // Supabase JWT puts the user ID in the 'sub' claim
    const userId = decoded.sub || decoded.id;
    
    // Fetch user profile from database to get role and company_id
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(403).json({ error: 'User profile not found.' });
    }

    req.user = user;

    // ── Company scoping ───────────────────────────────────────────
    if (user.role === 'super_admin') {
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
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
  }
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
