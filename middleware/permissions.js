/**
 * middleware/permissions.js
 *
 * Central permission matrix for all 5 roles.
 * Never scattered across individual routes — imported and applied here.
 *
 * Usage in routes:
 *   const { can } = require('../middleware/permissions');
 *
 *   router.get('/',   authenticateToken, can('employees', 'read'),                  handler);
 *   router.post('/',  authenticateToken, can('attendance', 'write', { allowOwn: true }), handler);
 *
 * When allowOwn: true is passed, *_own permission levels are accepted
 * and req.ownOnly is set to true so the handler can enforce ownership.
 */

// ── Permission matrix ─────────────────────────────────────────────
// Values per cell (weakest → strongest): none < read_own < write_own < read < write < full
//
//            companies  users      employees  products  inventory  payroll    attendance  cart
// super_admin  full       full       full       full      full       full       full        full
// admin        read       full       full       full      full       full       full        full
// hr           none       none       full       none      none       none       write       none
// manager      none       none       read       full      full       none       read        full
// employee     none       none       read_own   read      none       read_own   write_own   write

const MATRIX = {
  super_admin: {
    companies:  'full', users: 'full',  employees: 'full',
    products:   'full', inventory: 'full', payroll: 'full',
    attendance: 'full', cart: 'full',
  },
  admin: {
    companies:  'read', users: 'full',  employees: 'full',
    products:   'full', inventory: 'full', payroll: 'full',
    attendance: 'full', cart: 'full',
  },
  hr: {
    employees:  'full',
    attendance: 'write',
    // all others → 'none' (absent from object)
  },
  manager: {
    employees:  'read',
    products:   'full', inventory: 'full',
    attendance: 'read', cart: 'full',
  },
  employee: {
    employees:  'read_own',
    products:   'read',
    payroll:    'read_own',
    attendance: 'write_own',
    cart:       'write',
  },
};

// Numeric levels for comparison
const LEVEL = {
  none:      0,
  read_own:  1,
  write_own: 2,
  read:      3,
  write:     4,
  full:      5,
};

function permLevel(role, resource) {
  const perm = MATRIX[role]?.[resource] ?? 'none';
  return { perm, level: LEVEL[perm] ?? 0 };
}

/**
 * can(resource, action, [options])
 *
 * Middleware factory. Returns 403 if the authenticated user's role
 * does not have the required permission level for the given resource.
 *
 * @param {string}  resource   One of: companies | users | employees | products |
 *                             inventory | payroll | attendance | cart
 * @param {string}  action     'read' | 'write' | 'delete'
 * @param {object}  options
 *   @param {boolean} allowOwn  When true, *_own levels are accepted and
 *                              req.ownOnly is set to true for the route handler.
 */
function can(resource, action, { allowOwn = false } = {}) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'Not authenticated.' });

    const { level } = permLevel(role, resource);

    // Full access always passes
    if (level >= LEVEL.full) return next();

    // Determine required minimum level for this action
    const required = action === 'read' ? LEVEL.read : LEVEL.write;

    if (level >= required) return next();

    // _own levels: only accepted when the route opts in
    if (allowOwn) {
      const ownRequired = action === 'read' ? LEVEL.read_own : LEVEL.write_own;
      if (level >= ownRequired) {
        req.ownOnly = true; // signal to the handler to enforce ownership
        return next();
      }
    }

    return res.status(403).json({
      error: `Your role '${role}' does not have '${action}' access to '${resource}'.`,
    });
  };
}

module.exports = { can, MATRIX, permLevel, LEVEL };
