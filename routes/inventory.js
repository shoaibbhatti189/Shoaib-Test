const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_REASONS = ['sale', 'restock', 'damage', 'adjustment'];

// Helper: company scope fragment
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// POST /inventory/transaction — record a stock movement (admin, manager, super_admin)
router.post('/transaction', authenticateToken, requireRole('admin', 'manager', 'super_admin'), async (req, res) => {
  try {
    const { product_id, change_amount, reason } = req.body;
    const employee_id = req.user.employee_id || null;

    if (!product_id || change_amount === undefined || !reason)
      return res.status(400).json({ error: 'product_id, change_amount, and reason are required.' });

    if (!VALID_REASONS.includes(reason))
      return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}.` });

    if (!Number.isInteger(change_amount))
      return res.status(400).json({ error: 'change_amount must be an integer.' });

    // Verify the product belongs to the same company
    const product = await prisma.product.findFirst({
      where: { id: product_id, ...co(req) }
    });
    if (!product)
      return res.status(404).json({ error: 'Product not found.' });

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.inventoryTransaction.create({
        data: {
          company_id:    req.companyId,
          product_id,
          change_amount,
          reason,
          employee_id
        }
      });

      // Recalculate stock by summing all change_amounts for this product
      const aggregate = await tx.inventoryTransaction.aggregate({
        _sum: { change_amount: true },
        where: { product_id }
      });

      const newStock = aggregate._sum.change_amount ?? 0;

      await tx.product.update({
        where: { id: product_id },
        data:  { quantity_in_stock: newStock }
      });

      return { transaction, newStock };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('[POST /inventory/transaction]', error);
    if (error.code === 'P2025')
      return res.status(404).json({ error: 'Product not found.' });
    res.status(500).json({ error: 'Failed to record inventory transaction.' });
  }
});

// GET /inventory/transactions — transaction log (admin, manager, super_admin)
router.get('/transactions', authenticateToken, requireRole('admin', 'manager', 'super_admin'), async (req, res) => {
  try {
    const { product_id } = req.query;

    const where = { ...co(req) };
    if (product_id) where.product_id = product_id;

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200
    });
    res.json(transactions);
  } catch (error) {
    console.error('[GET /inventory/transactions]', error);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

module.exports = router;
