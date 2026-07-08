const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Allowed values matching the Supabase CHECK constraint on inventory_transactions.reason
const VALID_REASONS = ['sale', 'restock', 'damage', 'adjustment'];

router.post('/transaction', authenticateToken, async (req, res) => {
  try {
    const { product_id, change_amount, reason } = req.body;
    const employee_id = req.user.employee_id || null;

    if (!product_id || change_amount === undefined || !reason)
      return res.status(400).json({ error: 'product_id, change_amount, and reason are required' });

    if (!VALID_REASONS.includes(reason))
      return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });

    if (typeof change_amount !== 'number' || !Number.isInteger(change_amount))
      return res.status(400).json({ error: 'change_amount must be an integer' });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Write the transaction log entry
      const transaction = await tx.inventoryTransaction.create({
        data: { product_id, change_amount, reason, employee_id }
      });

      // 2. Recalculate stock by summing all change_amounts for this product
      const aggregate = await tx.inventoryTransaction.aggregate({
        _sum: { change_amount: true },
        where: { product_id }
      });

      const newStock = aggregate._sum.change_amount ?? 0;

      // 3. Sync the cached quantity_in_stock on the product row
      await tx.product.update({
        where: { id: product_id },
        data: { quantity_in_stock: newStock }
      });

      return { transaction, newStock };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.query;
    const where = product_id ? { product_id } : {};

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 100
    });
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
