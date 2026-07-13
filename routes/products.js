const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();


// Get all active products
router.get('/', authenticateToken, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { is_active: true }
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get low-stock products — uses PostgreSQL-compatible raw comparison
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    // Prisma doesn't support column-to-column comparisons natively,
    // so we fetch active products and filter in JS (safe for small catalogs)
    const allProducts = await prisma.product.findMany({
      where: { is_active: true }
    });
    const lowStock = allProducts.filter(
      (p) => p.quantity_in_stock <= p.low_stock_threshold
    );
    res.json(lowStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Create a product
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, sku, unit_cost, unit_price, low_stock_threshold } = req.body;

    if (!name || !sku || !unit_cost || !unit_price) {
      return res.status(400).json({ error: 'name, sku, unit_cost, and unit_price are required' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        unit_cost,
        unit_price,
        low_stock_threshold: low_stock_threshold ?? 10,
        quantity_in_stock: 0
      }
    });
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A product with this SKU already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin only: Update a product (never touch quantity_in_stock directly)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, sku, unit_cost, unit_price, low_stock_threshold, is_active } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { name, sku, unit_cost, unit_price, low_stock_threshold, is_active }
    });
    res.json(product);
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
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
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
