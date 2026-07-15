const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: company scope fragment
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// POST /payroll/run — run payroll for a date range (admin, super_admin)
router.post('/run', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { period_start, period_end, standard_deduction = 0 } = req.body;

    if (!period_start || !period_end)
      return res.status(400).json({ error: 'period_start and period_end are required.' });

    const start = new Date(`${period_start}T00:00:00.000Z`);
    const end   = new Date(`${period_end}T23:59:59.999Z`);

    if (isNaN(start) || isNaN(end))
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

    if (start > end)
      return res.status(400).json({ error: 'period_start must be before or equal to period_end.' });

    if (!req.companyId)
      return res.status(400).json({ error: 'Cannot run payroll without a company context.' });

    // 1. Create the PayrollRun record — scoped to this company
    const payrollRun = await prisma.payrollRun.create({
      data: {
        company_id:   req.companyId,
        period_start: start,
        period_end:   end,
        status:       'draft'
      }
    });

    // 2. Find all active employees in this company
    const employees = await prisma.employee.findMany({
      where: { is_active: true, ...co(req) }
    });

    if (!employees.length) {
      return res.status(400).json({
        error: 'No active employees found for this company in the given period.'
      });
    }

    const paychecks = [];

    // 3. Calculate pay per employee based on their attendance records in this period
    for (const employee of employees) {
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          employee_id: employee.id,
          ...co(req),
          date: { gte: start, lte: end }
        }
      });

      const totalHours = attendanceRecords.reduce(
        (sum, r) => sum + parseFloat(r.hours_worked), 0
      );

      const hourlyRate = parseFloat(employee.hourly_rate);
      const grossPay   = parseFloat((totalHours * hourlyRate).toFixed(2));
      // Deductions cannot exceed gross pay — no negative net pay
      const deductions = parseFloat(Math.min(standard_deduction, grossPay).toFixed(2));
      const netPay     = parseFloat((grossPay - deductions).toFixed(2));

      const paycheck = await prisma.paycheck.create({
        data: {
          payroll_run_id: payrollRun.id,
          employee_id:    employee.id,
          gross_pay:      grossPay,
          deductions,
          net_pay:        netPay
        }
      });

      paychecks.push(paycheck);
    }

    res.status(201).json({ payrollRun, paychecks });
  } catch (error) {
    console.error('[POST /payroll/run]', error);
    res.status(500).json({ error: 'Failed to run payroll.' });
  }
});

// GET /payroll/runs — list all payroll runs for this company (admin, super_admin)
router.get('/runs', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const runs = await prisma.payrollRun.findMany({
      where:   { ...co(req) },
      orderBy: { created_at: 'desc' }
    });
    res.json(runs);
  } catch (error) {
    console.error('[GET /payroll/runs]', error);
    res.status(500).json({ error: 'Failed to fetch payroll runs.' });
  }
});

// GET /payroll/runs/:id — single payroll run with paychecks (admin, super_admin)
router.get('/runs/:id', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const run = await prisma.payrollRun.findFirst({
      where:   { id: req.params.id, ...co(req) },
      include: { paychecks: { include: { employee: true } } }
    });
    if (!run)
      return res.status(404).json({ error: 'Payroll run not found.' });
    res.json(run);
  } catch (error) {
    console.error('[GET /payroll/runs/:id]', error);
    res.status(500).json({ error: 'Failed to fetch payroll run.' });
  }
});

// GET /payroll/paycheck/:id — single paycheck
// Admin/super_admin: any paycheck in their company
// Employee: only their own paycheck
router.get('/paycheck/:id', authenticateToken, async (req, res) => {
  try {
    const paycheck = await prisma.paycheck.findFirst({
      where:   { id: req.params.id },
      include: { employee: true, payroll_run: true }
    });

    if (!paycheck)
      return res.status(404).json({ error: 'Paycheck not found.' });

    // Verify the paycheck belongs to the same company (via payroll_run)
    if (req.companyId && paycheck.payroll_run.company_id !== req.companyId)
      return res.status(403).json({ error: 'Access denied.' });

    // Non-admin roles can only view their own paycheck
    const elevatedRoles = ['super_admin', 'admin', 'hr'];
    if (!elevatedRoles.includes(req.user.role) && req.user.employee_id !== paycheck.employee_id)
      return res.status(403).json({ error: 'You can only view your own paycheck.' });

    res.json(paycheck);
  } catch (error) {
    console.error('[GET /payroll/paycheck/:id]', error);
    res.status(500).json({ error: 'Failed to fetch paycheck.' });
  }
});

module.exports = router;
