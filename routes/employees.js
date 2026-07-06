const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get current logged-in employee's details (staff or admin)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user.employee_id) {
      return res.status(404).json({ error: 'No employee record linked to this user' });
    }
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employee_id }
    });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Get all employees (excluding soft-deleted by default, or you can include a filter)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { is_active: true }
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Create a new employee
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, role_title, hourly_rate, hire_date } = req.body;
    const employee = await prisma.employee.create({
      data: {
        name,
        role_title,
        hourly_rate,
        hire_date: new Date(hire_date)
      }
    });
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Get employee by id
router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id }
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Update employee
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, role_title, hourly_rate, is_active } = req.body;
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { name, role_title, hourly_rate, is_active }
    });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Soft delete employee
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { is_active: false }
    });
    res.json({ message: 'Employee deactivated (soft deleted)', employee });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
