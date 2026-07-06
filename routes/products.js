const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all products (anyone logged in)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { is_active: true }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get low stock products (anyone logged in)
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    // using Prisma to find where quantity_in_stock <= low_stock_threshold
    const products = await prisma.product.findMany({
      where: { 
        is_active: true,
        quantity_in_stock: { lte: prisma.product.fields.low_stock_threshold }
      }
    });
    // Fallback if field comparison doesn't work out of the box in this prisma version:
    // const allProducts = await prisma.product.findMany({ where: { is_active: true } });
    // const products = allProducts.filter(p => p.quantity_in_stock <= p.low_stock_threshold);
    res.json(products);
  } catch (error) {
    // Handling fallback for the lte field comparison if needed
    try {
      const allProducts = await prisma.product.findMany({ where: { is_active: true } });
      const products = allProducts.filter(p => p.quantity_in_stock <= p.low_stock_threshold);
      res.json(products);
    } catch(err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// Admin only: Create a product
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, sku, unit_cost, unit_price, low_stock_threshold } = req.body;
    const product = await prisma.product.create({
      data: {
        name,
        sku,
        unit_cost,
        unit_price,
        low_stock_threshold,
        quantity_in_stock: 0 // Initialize at 0, updated via transactions
      }
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Update a product
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, sku, unit_cost, unit_price, low_stock_threshold, is_active } = req.body;
    // Note: quantity_in_stock is NOT updated directly here.
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { name, sku, unit_cost, unit_price, low_stock_threshold, is_active }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Soft delete product
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { is_active: false }
    });
    res.json({ message: 'Product deactivated', product });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
