const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin only: Run payroll for a date range
router.post('/run', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { period_start, period_end, standard_deduction = 0 } = req.body;

    if (!period_start || !period_end)
      return res.status(400).json({ error: 'period_start and period_end are required' });

    const start = new Date(period_start);
    const end = new Date(period_end);

    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ error: 'Invalid date format for period_start or period_end' });

    if (start > end)
      return res.status(400).json({ error: 'period_start must be before period_end' });

    // 1. Create the PayrollRun record
    const payrollRun = await prisma.payrollRun.create({
      data: { period_start: start, period_end: end, status: 'draft' }
    });

    // 2. Find all active employees
    const employees = await prisma.employee.findMany({ where: { is_active: true } });

    const paychecks = [];

    // 3. Calculate pay for each employee based on their attendance in this period
    for (const employee of employees) {
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          employee_id: employee.id,
          date: { gte: start, lte: end }
        }
      });

      // Sum all hours worked (hourly_rate is Decimal from Postgres, cast to float for math)
      const totalHours = attendanceRecords.reduce(
        (sum, r) => sum + parseFloat(r.hours_worked),
        0
      );

      const hourlyRate = parseFloat(employee.hourly_rate);
      const grossPay = parseFloat((totalHours * hourlyRate).toFixed(2));
      // Deductions cannot exceed gross pay — prevents negative net pay
      const deductions = parseFloat(Math.min(standard_deduction, grossPay).toFixed(2));
      const netPay = parseFloat((grossPay - deductions).toFixed(2));

      const paycheck = await prisma.paycheck.create({
        data: {
          payroll_run_id: payrollRun.id,
          employee_id: employee.id,
          gross_pay: grossPay,
          deductions,
          net_pay: netPay
        }
      });

      paychecks.push(paycheck);
    }

    res.status(201).json({ payrollRun, paychecks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: List all payroll runs
router.get('/runs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const runs = await prisma.payrollRun.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json(runs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Get a single payroll run with all its paychecks
router.get('/runs/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const run = await prisma.payrollRun.findUnique({
      where: { id: req.params.id },
      include: {
        paychecks: { include: { employee: true } }
      }
    });
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    res.json(run);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Any authenticated user: Get a paycheck by ID (staff can only see their own)
router.get('/paycheck/:id', authenticateToken, async (req, res) => {
  try {
    const paycheck = await prisma.paycheck.findUnique({
      where: { id: req.params.id },
      include: { employee: true, payroll_run: true }
    });

    if (!paycheck) return res.status(404).json({ error: 'Paycheck not found' });

    if (req.user.role !== 'admin' && req.user.employee_id !== paycheck.employee_id)
      return res.status(403).json({ error: 'Access denied: Cannot view other employee paycheck' });

    res.json(paycheck);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
