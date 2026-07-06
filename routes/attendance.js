const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Post attendance (staff or admin can post their own, admin can post for anyone if employee_id is provided)
router.post('/', authenticateToken, async (req, res) => {
  try {
    let { employee_id, date, hours_worked } = req.body;
    
    // If not admin, force employee_id to the logged-in user's employee_id
    if (req.user.role !== 'admin') {
      employee_id = req.user.employee_id;
    }

    if (!employee_id) return res.status(400).json({ error: 'Employee ID is required' });

    const attendance = await prisma.attendance.create({
      data: {
        employee_id,
        date: new Date(date),
        hours_worked
      }
    });
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get attendance for an employee (admin can view any, staff can only view their own)
router.get('/:employee_id', authenticateToken, async (req, res) => {
  try {
    const { employee_id } = req.params;

    if (req.user.role !== 'admin' && req.user.employee_id !== employee_id) {
      return res.status(403).json({ error: 'Access denied: Cannot view other employee records' });
    }

    const records = await prisma.attendance.findMany({
      where: { employee_id },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
