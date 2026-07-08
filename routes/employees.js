const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user.employee_id)
      return res.status(404).json({ error: 'No employee record linked to this user' });

    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employee_id }
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({ where: { is_active: true } });
    res.json(employees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, role_title, hourly_rate, hire_date } = req.body;

    if (!name || !role_title || !hourly_rate || !hire_date)
      return res.status(400).json({ error: 'name, role_title, hourly_rate, and hire_date are required' });

    const employee = await prisma.employee.create({
      data: {
        name,
        role_title,
        hourly_rate: parseFloat(hourly_rate),
        hire_date: new Date(hire_date)
      }
    });
    res.status(201).json(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, role_title, hourly_rate, is_active } = req.body;

    // Build update object with only the fields that were actually sent
    const data = {};
    if (name !== undefined) data.name = name;
    if (role_title !== undefined) data.role_title = role_title;
    if (hourly_rate !== undefined) data.hourly_rate = parseFloat(hourly_rate);
    if (is_active !== undefined) data.is_active = is_active;

    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'No valid fields provided for update' });

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data
    });
    res.json(employee);
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Employee not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { is_active: false }
    });
    res.json({ message: 'Employee deactivated', employee });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Employee not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
