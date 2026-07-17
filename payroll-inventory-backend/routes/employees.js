const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken }     = require('../middleware/auth');
const { can }                   = require('../middleware/permissions');

const router = express.Router();
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// GET /employees/me — own employee record (any authenticated user)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user.employee_id)
      return res.status(404).json({ error: 'No employee record is linked to your account.' });

    const employee = await prisma.employee.findFirst({
      where: { id: req.user.employee_id, ...co(req) }
    });
    if (!employee)
      return res.status(404).json({ error: 'Employee record not found.' });

    res.json(employee);
  } catch (error) {
    console.error('[GET /employees/me]', error);
    res.status(500).json({ error: 'Failed to load employee profile.' });
  }
});

// GET /employees — list all active employees
// super_admin, admin, hr, manager: full list
// employee: blocked (use /me instead)
router.get('/', authenticateToken, can('employees', 'read'), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where:   { is_active: true, ...co(req) },
      orderBy: { name: 'asc' },
    });
    res.json(employees);
  } catch (error) {
    console.error('[GET /employees]', error);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

// POST /employees — create a new employee
// super_admin, admin, hr
router.post('/', authenticateToken, can('employees', 'write'), async (req, res) => {
  try {
    const { name, role_title, hourly_rate, hire_date } = req.body;

    const missing = [];
    if (!name)        missing.push('name');
    if (!role_title)  missing.push('role_title');
    if (!hourly_rate) missing.push('hourly_rate');
    if (!hire_date)   missing.push('hire_date');
    if (missing.length)
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}.` });

    const rate = parseFloat(hourly_rate);
    if (isNaN(rate) || rate < 0)
      return res.status(400).json({ error: 'hourly_rate must be a non-negative number.' });

    const parsedDate = new Date(`${hire_date}T12:00:00.000Z`);
    if (isNaN(parsedDate.getTime()))
      return res.status(400).json({ error: 'hire_date must be in YYYY-MM-DD format.' });

    if (!req.companyId)
      return res.status(400).json({ error: 'Cannot create employee without a company context.' });

    const employee = await prisma.employee.create({
      data: {
        company_id:  req.companyId,
        name:        name.trim(),
        role_title:  role_title.trim(),
        hourly_rate: rate,
        hire_date:   parsedDate,
      }
    });
    res.status(201).json(employee);
  } catch (error) {
    console.error('[POST /employees]', error);
    if (error.code === 'P2002')
      return res.status(409).json({ error: 'An employee with this name already exists in your company.' });
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

// GET /employees/:id — single employee by ID
// super_admin, admin, hr, manager: any employee in company
// employee: blocked (use /me)
router.get('/:id', authenticateToken, can('employees', 'read'), async (req, res) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params.id, ...co(req) }
    });
    if (!employee)
      return res.status(404).json({ error: 'Employee not found.' });
    res.json(employee);
  } catch (error) {
    console.error('[GET /employees/:id]', error);
    res.status(500).json({ error: 'Failed to fetch employee.' });
  }
});

// PUT /employees/:id — update employee details
// super_admin, admin, hr
router.put('/:id', authenticateToken, can('employees', 'write'), async (req, res) => {
  try {
    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, ...co(req) }
    });
    if (!existing)
      return res.status(404).json({ error: 'Employee not found.' });

    const { name, role_title, hourly_rate, is_active } = req.body;
    const data = {};
    if (name        !== undefined) data.name        = name.trim();
    if (role_title  !== undefined) data.role_title   = role_title.trim();
    if (hourly_rate !== undefined) {
      const rate = parseFloat(hourly_rate);
      if (isNaN(rate) || rate < 0)
        return res.status(400).json({ error: 'hourly_rate must be a non-negative number.' });
      data.hourly_rate = rate;
    }
    if (is_active !== undefined) data.is_active = Boolean(is_active);

    if (!Object.keys(data).length)
      return res.status(400).json({ error: 'No valid fields provided for update.' });

    const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
    res.json(employee);
  } catch (error) {
    console.error('[PUT /employees/:id]', error);
    if (error.code === 'P2025')
      return res.status(404).json({ error: 'Employee not found.' });
    res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// DELETE /employees/:id — soft-deactivate
// super_admin, admin (hr cannot deactivate — only create/edit)
router.delete('/:id', authenticateToken, can('employees', 'delete'), async (req, res) => {
  try {
    // hr has 'full' on employees which resolves to LEVEL 5 (≥ write=4) → passes can()
    // But per spec, only admin/super_admin should deactivate. Apply explicit guard:
    if (req.user.role === 'hr')
      return res.status(403).json({ error: 'HR cannot deactivate employees. Contact an admin.' });

    const existing = await prisma.employee.findFirst({
      where: { id: req.params.id, ...co(req) }
    });
    if (!existing)
      return res.status(404).json({ error: 'Employee not found.' });

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data:  { is_active: false },
    });
    res.json({ message: `${employee.name} has been deactivated.`, employee });
  } catch (error) {
    console.error('[DELETE /employees/:id]', error);
    res.status(500).json({ error: 'Failed to deactivate employee.' });
  }
});

module.exports = router;
