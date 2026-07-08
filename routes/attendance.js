const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    let { employee_id, date, hours_worked } = req.body;

    if (req.user.role !== 'admin') {
      employee_id = req.user.employee_id;
    }

    if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (hours_worked === undefined || hours_worked === null)
      return res.status(400).json({ error: 'hours_worked is required' });
    if (parseFloat(hours_worked) < 0 || parseFloat(hours_worked) > 24)
      return res.status(400).json({ error: 'hours_worked must be between 0 and 24' });

    const attendance = await prisma.attendance.create({
      data: {
        employee_id,
        date: new Date(date),
        hours_worked: parseFloat(hours_worked)
      }
    });
    res.status(201).json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:employee_id', authenticateToken, async (req, res) => {
  try {
    const { employee_id } = req.params;

    if (req.user.role !== 'admin' && req.user.employee_id !== employee_id)
      return res.status(403).json({ error: 'Access denied: Cannot view other employee records' });

    const records = await prisma.attendance.findMany({
      where: { employee_id },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
