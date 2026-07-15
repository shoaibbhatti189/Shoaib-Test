const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /employees/me — logged-in staff user's own employee record
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user.employee_id)
      return res.status(404).json({ error: 'No employee record is linked to your account.' });

    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employee_id }
    });
    if (!employee)
      return res.status(404).json({ error: 'Employee record not found.' });

    res.json(employee);
  } catch (error) {
    console.error('[GET /employees/me]', error);
    res.status(500).json({ error: 'Failed to load employee profile.' });
  }
});

// GET /employees — all active employees (admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });
    res.json(employees);
  } catch (error) {
    console.error('[GET /employees]', error);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

// POST /employees — create a new employee (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, role_title, hourly_rate, hire_date } = req.body;

    // Validate required fields
    const missing = [];
    if (!name)        missing.push('name');
    if (!role_title)  missing.push('role_title');
    if (!hourly_rate) missing.push('hourly_rate');
    if (!hire_date)   missing.push('hire_date');

    if (missing.length > 0)
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`
      });

    const rate = parseFloat(hourly_rate);
    if (isNaN(rate) || rate < 0)
      return res.status(400).json({ error: 'hourly_rate must be a positive number.' });

    // Parse hire_date safely — append UTC noon to avoid timezone day-shift issues
    const parsedDate = new Date(`${hire_date}T12:00:00.000Z`);
    if (isNaN(parsedDate.getTime()))
      return res.status(400).json({ error: 'hire_date is not a valid date. Use YYYY-MM-DD format.' });

    const employee = await prisma.employee.create({
      data: {
        name: name.trim(),
        role_title: role_title.trim(),
        hourly_rate: rate,
        hire_date: parsedDate
      }
    });

    res.status(201).json(employee);
  } catch (error) {
    console.error('[POST /employees]', error);

    // Prisma unique constraint violation
    if (error.code === 'P2002')
      return res.status(409).json({ error: 'An employee with this name already exists.' });

    res.status(500).json({ error: 'Failed to create employee. Please try again.' });
  }
});

// GET /employees/:id — single employee (admin only)
router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id }
    });
    if (!employee)
      return res.status(404).json({ error: 'Employee not found.' });

    res.json(employee);
  } catch (error) {
    console.error('[GET /employees/:id]', error);
    if (error.code === 'P2023')
      return res.status(400).json({ error: 'Invalid employee ID format.' });
    res.status(500).json({ error: 'Failed to fetch employee.' });
  }
});

// PUT /employees/:id — update employee fields (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, role_title, hourly_rate, is_active } = req.body;

    const data = {};
    if (name       !== undefined) data.name       = name.trim();
    if (role_title !== undefined) data.role_title  = role_title.trim();
    if (hourly_rate !== undefined) {
      const rate = parseFloat(hourly_rate);
      if (isNaN(rate) || rate < 0)
        return res.status(400).json({ error: 'hourly_rate must be a positive number.' });
      data.hourly_rate = rate;
    }
    if (is_active !== undefined) data.is_active = Boolean(is_active);

    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'No valid fields provided for update.' });

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data
    });
    res.json(employee);
  } catch (error) {
    console.error('[PUT /employees/:id]', error);
    if (error.code === 'P2025')
      return res.status(404).json({ error: 'Employee not found.' });
    res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// DELETE /employees/:id — soft-delete (set is_active = false) (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { is_active: false }
    });
    res.json({ message: `${employee.name} has been deactivated.`, employee });
  } catch (error) {
    console.error('[DELETE /employees/:id]', error);
    if (error.code === 'P2025')
      return res.status(404).json({ error: 'Employee not found.' });
    res.status(500).json({ error: 'Failed to deactivate employee.' });
  }
});

module.exports = router;
