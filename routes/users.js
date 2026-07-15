const express = require('express');
const bcrypt  = require('bcrypt');
const prisma  = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { can } = require('../middleware/permissions');

const router = express.Router();
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

const VALID_ROLES = ['super_admin', 'admin', 'hr', 'manager', 'employee'];

// GET /users — list users
router.get('/', authenticateToken, can('users', 'read'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { ...co(req) },
      select: {
        id: true,
        username: true,
        role: true,
        company_id: true,
        employee_id: true,
        created_at: true,
        updated_at: true
      },
      orderBy: { username: 'asc' }
    });
    res.json(users);
  } catch (error) {
    console.error('[GET /users]', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// POST /users — create a new user
router.post('/', authenticateToken, can('users', 'write'), async (req, res) => {
  try {
    const { username, password, role, company_id, employee_id } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'username, password, and role are required.' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    // Role hierarchy checks
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super_admin can create another super_admin.' });
    }
    if (role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super_admin can create an admin.' });
    }

    let targetCompanyId = req.companyId;

    if (req.user.role === 'super_admin') {
      // Super admin must provide company_id unless creating another super_admin
      if (role === 'super_admin') {
        targetCompanyId = null;
      } else {
        if (!company_id) {
          return res.status(400).json({ error: 'company_id is required when a super_admin creates a regular user.' });
        }
        targetCompanyId = company_id;
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password_hash,
        role,
        company_id: targetCompanyId,
        employee_id: employee_id || null
      },
      select: {
        id: true,
        username: true,
        role: true,
        company_id: true,
        employee_id: true
      }
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('[POST /users]', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A user with this username already exists.' });
    }
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PUT /users/:id — update user details (role, employee_id)
router.put('/:id', authenticateToken, can('users', 'write'), async (req, res) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, ...co(req) }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { role, employee_id } = req.body;
    const data = {};

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      }
      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a super_admin can assign the super_admin role.' });
      }
      if (role === 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only a super_admin can assign the admin role.' });
      }
      data.role = role;
    }

    if (employee_id !== undefined) {
      data.employee_id = employee_id;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, username: true, role: true, employee_id: true }
    });
    
    res.json(user);
  } catch (error) {
    console.error('[PUT /users/:id]', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// DELETE /users/:id — delete user
router.delete('/:id', authenticateToken, can('users', 'delete'), async (req, res) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, ...co(req) }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (existing.role === 'super_admin' && req.user.id !== existing.id) {
       return res.status(403).json({ error: 'Cannot delete another super_admin.' });
    }

    await prisma.user.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'User deleted.' });
  } catch (error) {
    console.error('[DELETE /users/:id]', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// POST /users/:id/set-pin — Admin sets PIN for a manager/admin
router.post('/:id/set-pin', authenticateToken, can('users', 'write'), async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || pin.length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 characters long.' });
    }

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, ...co(req) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!['manager', 'admin', 'super_admin'].includes(existing.role)) {
      return res.status(400).json({ error: 'PINs can only be set for managers, admins, or super_admins.' });
    }

    const pin_code_hash = await bcrypt.hash(pin, 10);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { pin_code_hash }
    });

    res.json({ message: 'PIN set successfully.' });
  } catch (error) {
    console.error('[POST /users/:id/set-pin]', error);
    res.status(500).json({ error: 'Failed to set PIN.' });
  }
});

module.exports = router;
