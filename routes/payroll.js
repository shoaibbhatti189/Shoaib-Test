const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { can }               = require('../middleware/permissions');

const router = express.Router();
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// POST /payroll/run — calculate and create paychecks for a pay period
// super_admin, admin only
router.post('/run', authenticateToken, can('payroll', 'write'), async (req, res) => {
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

    const payrollRun = await prisma.payrollRun.create({
      data: { company_id: req.companyId, period_start: start, period_end: end, status: 'draft' }
    });

    const employees = await prisma.employee.findMany({
      where: { is_active: true, ...co(req) }
    });

    if (!employees.length) {
      // Clean up orphaned run before returning
      await prisma.payrollRun.delete({ where: { id: payrollRun.id } });
      return res.status(400).json({ error: 'No active employees found for this company.' });
    }

    const paychecks = [];

    for (const employee of employees) {
      const attendanceRecords = await prisma.attendance.findMany({
        where: { employee_id: employee.id, ...co(req), date: { gte: start, lte: end } }
      });

      const totalHours = attendanceRecords.reduce((sum, r) => sum + parseFloat(r.hours_worked), 0);
      const hourlyRate = parseFloat(employee.hourly_rate);
      const grossPay   = parseFloat((totalHours * hourlyRate).toFixed(2));
      const deductions = parseFloat(Math.min(standard_deduction, grossPay).toFixed(2));
      const netPay     = parseFloat((grossPay - deductions).toFixed(2));

      paychecks.push(
        await prisma.paycheck.create({
          data: { payroll_run_id: payrollRun.id, employee_id: employee.id, gross_pay: grossPay, deductions, net_pay: netPay }
        })
      );
    }

    res.status(201).json({ payrollRun, paychecks });
  } catch (error) {
    console.error('[POST /payroll/run]', error);
    res.status(500).json({ error: 'Failed to run payroll.' });
  }
});

// GET /payroll/runs — list payroll runs for this company
// super_admin, admin
router.get('/runs', authenticateToken, can('payroll', 'read'), async (req, res) => {
  try {
    const runs = await prisma.payrollRun.findMany({
      where:   { ...co(req) },
      orderBy: { created_at: 'desc' },
    });
    res.json(runs);
  } catch (error) {
    console.error('[GET /payroll/runs]', error);
    res.status(500).json({ error: 'Failed to fetch payroll runs.' });
  }
});

// GET /payroll/runs/:id — single run with all paychecks
// super_admin, admin
router.get('/runs/:id', authenticateToken, can('payroll', 'read'), async (req, res) => {
  try {
    const run = await prisma.payrollRun.findFirst({
      where:   { id: req.params.id, ...co(req) },
      include: { paychecks: { include: { employee: true } } },
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
// super_admin, admin: any paycheck in their company
// employee (read_own): only their own paycheck
router.get('/paycheck/:id', authenticateToken, can('payroll', 'read', { allowOwn: true }), async (req, res) => {
  try {
    const paycheck = await prisma.paycheck.findFirst({
      where:   { id: req.params.id },
      include: { employee: true, payroll_run: true },
    });
    if (!paycheck)
      return res.status(404).json({ error: 'Paycheck not found.' });

    // Verify the paycheck's run belongs to the same company
    if (req.companyId && paycheck.payroll_run?.company_id !== req.companyId)
      return res.status(403).json({ error: 'Access denied.' });

    // If req.ownOnly (employee role), they may only see their own paycheck
    if (req.ownOnly && req.user.employee_id !== paycheck.employee_id)
      return res.status(403).json({ error: 'You can only view your own paycheck.' });

    res.json(paycheck);
  } catch (error) {
    console.error('[GET /payroll/paycheck/:id]', error);
    res.status(500).json({ error: 'Failed to fetch paycheck.' });
  }
});

module.exports = router;
