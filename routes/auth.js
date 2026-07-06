const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Initial user setup (helper route, usually you'd seed this)
router.post('/setup-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password_hash, role: 'admin' }
    });
    
    res.json({ message: 'Admin created', user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, employee_id: user.employee_id },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      { expiresIn: '24h' }
    );

    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  // In a stateless JWT setup, logout is typically handled client-side by deleting the token.
  // We can just return success here.
  res.json({ message: 'Logged out successfully. Please remove token on client.' });
});

module.exports = router;
