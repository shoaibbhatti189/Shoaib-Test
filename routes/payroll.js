const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { Decimal } = require('@prisma/client/runtime/library');

const router = express.Router();
const prisma = new PrismaClient();

// Admin only: Run payroll
router.post('/run', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { period_start, period_end, standard_deduction = 0 } = req.body;

    if (!period_start || !period_end) {
      return res.status(400).json({ error: 'period_start and period_end are required' });
    }

    const start = new Date(period_start);
    const end = new Date(period_end);

    // 1. Create the PayrollRun record
    const payrollRun = await prisma.payrollRun.create({
      data: {
        period_start: start,
        period_end: end,
        status: 'draft' // can be updated to finalized later
      }
    });

    // 2. Find all active employees
    const employees = await prisma.employee.findMany({
      where: { is_active: true }
    });

    const paychecks = [];

    // 3. Calculate payroll for each employee
    for (const employee of employees) {
      // Get attendance records in this period
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          employee_id: employee.id,
          date: {
            gte: start,
            lte: end
          }
        }
      });

      // Sum hours worked
      const totalHours = attendanceRecords.reduce((sum, record) => {
        return sum + parseFloat(record.hours_worked);
      }, 0);

      // Calculate pay
      const hourlyRate = parseFloat(employee.hourly_rate);
      const grossPay = totalHours * hourlyRate;
      
      // Prevent negative net pay
      const deductions = Math.min(standard_deduction, grossPay); 
      const netPay = grossPay - deductions;

      // 4. Create Paycheck record
      const paycheck = await prisma.paycheck.create({
        data: {
          payroll_run_id: payrollRun.id,
          employee_id: employee.id,
          gross_pay: grossPay,
          deductions: deductions,
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

// Admin only: Get all payroll runs
router.get('/runs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const runs = await prisma.payrollRun.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Get a specific payroll run
router.get('/runs/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const run = await prisma.payrollRun.findUnique({
      where: { id: req.params.id },
      include: {
        paychecks: {
          include: { employee: true }
        }
      }
    });
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Get a specific paycheck (Staff would need a different route or we'd change logic to allow staff to see their own)
router.get('/paycheck/:id', authenticateToken, async (req, res) => {
  try {
    const paycheck = await prisma.paycheck.findUnique({
      where: { id: req.params.id }
    });

    if (!paycheck) return res.status(404).json({ error: 'Paycheck not found' });

    // Allow admin to see any, staff can only see their own
    if (req.user.role !== 'admin' && req.user.employee_id !== paycheck.employee_id) {
      return res.status(403).json({ error: 'Access denied: Cannot view other employee paycheck' });
    }

    res.json(paycheck);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
