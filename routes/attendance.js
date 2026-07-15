const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: company scope fragment
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// POST /attendance — log hours
// admin/hr/super_admin: can specify any employee_id
// manager: can specify employees in their company
// employee: always uses their own employee_id
router.post('/', authenticateToken, async (req, res) => {
  try {
    let { employee_id, date, hours_worked } = req.body;

    const role = req.user.role;

    // Determine effective employee_id
    if (role === 'employee') {
      employee_id = req.user.employee_id;
      if (!employee_id)
        return res.status(400).json({ error: 'Your account has no employee record linked.' });
    } else if (!employee_id) {
      return res.status(400).json({ error: 'employee_id is required.' });
    }

    if (!date)
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD).' });

    const hours = parseFloat(hours_worked);
    if (isNaN(hours) || hours < 0 || hours > 24)
      return res.status(400).json({ error: 'hours_worked must be between 0 and 24.' });

    // Verify the employee belongs to this company
    const employee = await prisma.employee.findFirst({
      where: { id: employee_id, ...co(req) }
    });
    if (!employee)
      return res.status(404).json({ error: 'Employee not found in your company.' });

    const parsedDate = new Date(`${date}T12:00:00.000Z`);
    if (isNaN(parsedDate.getTime()))
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

    const attendance = await prisma.attendance.create({
      data: {
        company_id:   req.companyId,
        employee_id,
        date:         parsedDate,
        hours_worked: hours
      }
    });
    res.status(201).json(attendance);
  } catch (error) {
    console.error('[POST /attendance]', error);
    res.status(500).json({ error: 'Failed to log attendance.' });
  }
});

// GET /attendance/:employee_id — fetch records for an employee
// admin/hr/manager/super_admin: any employee in their company
// employee: own records only
router.get('/:employee_id', authenticateToken, async (req, res) => {
  try {
    const { employee_id } = req.params;
    const role = req.user.role;

    // Employees may only view their own records
    if (role === 'employee' && req.user.employee_id !== employee_id)
      return res.status(403).json({ error: 'You can only view your own attendance records.' });

    // Verify the employee belongs to this company
    const employee = await prisma.employee.findFirst({
      where: { id: employee_id, ...co(req) }
    });
    if (!employee)
      return res.status(404).json({ error: 'Employee not found in your company.' });

    const records = await prisma.attendance.findMany({
      where:   { employee_id, ...co(req) },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (error) {
    console.error('[GET /attendance/:employee_id]', error);
    res.status(500).json({ error: 'Failed to fetch attendance records.' });
  }
});

module.exports = router;
