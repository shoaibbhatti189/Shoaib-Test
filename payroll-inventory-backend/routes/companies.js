const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { can } = require('../middleware/permissions');

const router = express.Router();

// GET /companies — list companies
// super_admin sees all. admin sees only their own company.
router.get('/', authenticateToken, can('companies', 'read'), async (req, res) => {
  try {
    const where = req.companyId ? { id: req.companyId } : {};
    
    const companies = await prisma.company.findMany({
      where,
      orderBy: { name: 'asc' }
    });
    res.json(companies);
  } catch (error) {
    console.error('[GET /companies]', error);
    res.status(500).json({ error: 'Failed to fetch companies.' });
  }
});

// POST /companies — create a new company (super_admin only)
router.post('/', authenticateToken, can('companies', 'write'), async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const company = await prisma.company.create({
      data: { name: name.trim() }
    });
    
    res.status(201).json(company);
  } catch (error) {
    console.error('[POST /companies]', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A company with this name already exists.' });
    }
    res.status(500).json({ error: 'Failed to create company.' });
  }
});

// PUT /companies/:id — update company details (super_admin only)
router.put('/:id', authenticateToken, can('companies', 'write'), async (req, res) => {
  try {
    const { name, is_active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (is_active !== undefined) data.is_active = Boolean(is_active);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data
    });
    
    res.json(company);
  } catch (error) {
    console.error('[PUT /companies/:id]', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Company not found.' });
    }
    res.status(500).json({ error: 'Failed to update company.' });
  }
});

// DELETE /companies/:id — soft delete company (super_admin only)
router.delete('/:id', authenticateToken, can('companies', 'delete'), async (req, res) => {
  try {
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { is_active: false }
    });
    
    res.json({ message: 'Company deactivated.', company });
  } catch (error) {
    console.error('[DELETE /companies/:id]', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Company not found.' });
    }
    res.status(500).json({ error: 'Failed to deactivate company.' });
  }
});

module.exports = router;
