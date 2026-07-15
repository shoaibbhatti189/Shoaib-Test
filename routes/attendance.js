const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { can }               = require('../middleware/permissions');

const router = express.Router();
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// POST /attendance — log attendance hours
// super_admin, admin, hr: can log for any employee in their company
// manager: cannot log (read-only on attendance per spec)
// employee (write_own): logs only for themselves
router.post('/', authenticateToken, can('attendance', 'write', { allowOwn: true }), async (req, res) => {
  try {
    let { employee_id, date, hours_worked } = req.body;
    const role = req.user.role;

    // Ownership enforcement: employees always use their own ID
    if (req.ownOnly) {
      employee_id = req.user.employee_id;
      if (!employee_id)
        return res.status(400).json({ error: 'Your account has no linked employee record.' });
    } else if (!employee_id) {
      return res.status(400).json({ error: 'employee_id is required.' });
    }

    if (!date)
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD).' });

    const hours = parseFloat(hours_worked);
    if (isNaN(hours) || hours < 0 || hours > 24)
      return res.status(400).json({ error: 'hours_worked must be between 0 and 24.' });

    // Verify the target employee belongs to the same company
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
        hours_worked: hours,
      }
    });
    res.status(201).json(attendance);
  } catch (error) {
    console.error('[POST /attendance]', error);
    res.status(500).json({ error: 'Failed to log attendance.' });
  }
});

// GET /attendance/:employee_id — fetch records for an employee
// super_admin, admin, hr, manager: any employee in their company
// employee (read_own): only their own records
router.get('/:employee_id', authenticateToken, can('attendance', 'read', { allowOwn: true }), async (req, res) => {
  try {
    const { employee_id } = req.params;

    // Ownership enforcement
    if (req.ownOnly && req.user.employee_id !== employee_id)
      return res.status(403).json({ error: 'You can only view your own attendance records.' });

    // Verify the employee belongs to the same company
    const employee = await prisma.employee.findFirst({
      where: { id: employee_id, ...co(req) }
    });
    if (!employee)
      return res.status(404).json({ error: 'Employee not found in your company.' });

    const records = await prisma.attendance.findMany({
      where:   { employee_id, ...co(req) },
      orderBy: { date: 'desc' },
    });
    res.json(records);
  } catch (error) {
    console.error('[GET /attendance/:employee_id]', error);
    res.status(500).json({ error: 'Failed to fetch attendance records.' });
  }
});

module.exports = router;
