const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Post inventory transaction (anyone logged in)
router.post('/transaction', authenticateToken, async (req, res) => {
  try {
    const { product_id, change_amount, reason } = req.body;
    const employee_id = req.user.employee_id;

    if (!product_id || change_amount === undefined || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Execute in a transaction to ensure both records are updated consistently
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          product_id,
          change_amount,
          reason,
          employee_id
        }
      });

      // 2. Recalculate stock by summing all transactions for this product
      const aggregate = await tx.inventoryTransaction.aggregate({
        _sum: {
          change_amount: true
        },
        where: {
          product_id: product_id
        }
      });

      const newStock = aggregate._sum.change_amount || 0;

      // 3. Update the product's quantity_in_stock cache
      await tx.product.update({
        where: { id: product_id },
        data: { quantity_in_stock: newStock }
      });

      return { transaction, newStock };
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get inventory transactions (anyone logged in can view, though you might restrict in a real app)
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      orderBy: { date: 'desc' },
      take: 100 // limit to recent 100 for performance
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
