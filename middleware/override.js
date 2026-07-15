/**
 * middleware/override.js
 *
 * Provides `requireOverrideOrElevated` middleware.
 * Use for actions that normal employees can't do (e.g. deleting cart items, finalizing checkout).
 *
 * Logic:
 * 1. If role is elevated (manager, admin, super_admin), they can proceed directly.
 * 2. If role is employee (or hr), they MUST provide a valid X-Override-Token header.
 * 3. The token is looked up in checkout_overrides. It must:
 *    - Match the action requested
 *    - Not be expired
 *    - Not be consumed
 * 4. If valid, it's marked as consumed and the request proceeds.
 */

const crypto = require('crypto');
const prisma = require('../lib/prisma');

const ELEVATED_ROLES = ['manager', 'admin', 'super_admin'];

function requireOverrideOrElevated(actionType) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Not authenticated.' });

      // 1. Elevated roles skip the override check
      if (ELEVATED_ROLES.includes(user.role)) {
        return next();
      }

      // 2. Employee needs an override token
      const token = req.headers['x-override-token'];
      if (!token) {
        return res.status(403).json({
          error: `Action '${actionType}' requires manager override. Please provide X-Override-Token.`,
          requires_override: true,
          action: actionType
        });
      }

      // 3. Hash the provided token to check against the DB
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const overrideRecord = await prisma.checkoutOverride.findUnique({
        where: { override_token_hash: tokenHash }
      });

      if (!overrideRecord) {
        return res.status(403).json({ error: 'Invalid override token.' });
      }

      // Ensure it's for this company
      if (req.companyId && overrideRecord.company_id !== req.companyId) {
        return res.status(403).json({ error: 'Invalid override token (wrong company).' });
      }

      // Ensure it matches the action
      if (overrideRecord.action !== actionType) {
        return res.status(403).json({ error: `Override token is for '${overrideRecord.action}', not '${actionType}'.` });
      }

      // Ensure it was requested by this user
      if (overrideRecord.requested_by_user_id !== user.id) {
        return res.status(403).json({ error: 'Override token was issued to a different user.' });
      }

      // Ensure it's not consumed
      if (overrideRecord.is_consumed) {
        return res.status(403).json({ error: 'Override token has already been used.' });
      }

      // Ensure it's not expired
      if (new Date() > overrideRecord.expires_at) {
        return res.status(403).json({ error: 'Override token has expired.' });
      }

      // 4. Valid! Mark as consumed.
      await prisma.checkoutOverride.update({
        where: { id: overrideRecord.id },
        data: { is_consumed: true }
      });

      next();
    } catch (error) {
      console.error('[requireOverrideOrElevated]', error);
      res.status(500).json({ error: 'Failed to process override check.' });
    }
  };
}

module.exports = { requireOverrideOrElevated };
