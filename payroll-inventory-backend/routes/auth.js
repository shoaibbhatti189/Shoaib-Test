const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const prisma  = require('../lib/prisma');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// POST /setup-admin — one-time admin bootstrap (not protected; idempotent guard inside)
router.post('/setup-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password are required.' });

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing)
      return res.status(400).json({ error: 'A user with this username already exists.' });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password_hash, role: 'admin' }
      // company_id intentionally null — the migration script will assign it
    });

    res.json({ message: 'Admin created.', user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('[POST /setup-admin]', error);
    res.status(500).json({ error: 'Failed to create admin.' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'username and password are required.' });

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user)
      return res.status(401).json({ error: 'Invalid username or password.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid username or password.' });

    // JWT payload — includes company_id so middleware can scope without a DB hit
    const payload = {
      id:          user.id,
      username:    user.username,
      role:        user.role,
      employee_id: user.employee_id,
      company_id:  user.company_id  // null for super_admin
    };

    const token = jwt.sign(payload, SECRET, { expiresIn: '24h' });

    res.json({
      token,
      role:       user.role,
      company_id: user.company_id,
      username:   user.username
    });
  } catch (error) {
    console.error('[POST /login]', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /logout (client-side token removal; server-side is stateless)
router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out. Remove your token on the client.' });
});

module.exports = router;
