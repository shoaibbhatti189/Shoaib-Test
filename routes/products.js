const express = require('express');
const prisma   = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { can }               = require('../middleware/permissions');

const router = express.Router();
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// GET /products — all active products
// All roles can read the catalog (employees need it for cart/sale flow)
router.get('/', authenticateToken, can('products', 'read'), async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where:   { is_active: true, ...co(req) },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (error) {
    console.error('[GET /products]', error);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// GET /products/low-stock — products at or below their threshold
// admin, manager, super_admin (not employee — they don't need stock alerts)
router.get('/low-stock', authenticateToken, can('inventory', 'read'), async (req, res) => {
  try {
    const all = await prisma.product.findMany({
      where: { is_active: true, ...co(req) }
    });
    res.json(all.filter(p => p.quantity_in_stock <= p.low_stock_threshold));
  } catch (error) {
    console.error('[GET /products/low-stock]', error);
    res.status(500).json({ error: 'Failed to fetch low-stock products.' });
  }
});

// POST /products — create product
// super_admin, admin, manager
router.post('/', authenticateToken, can('products', 'write'), async (req, res) => {
  try {
    const { name, sku, unit_cost, unit_price, low_stock_threshold } = req.body;

    if (!name || !sku || unit_cost === undefined || unit_price === undefined)
      return res.status(400).json({ error: 'name, sku, unit_cost, and unit_price are required.' });

    const cost  = parseFloat(unit_cost);
    const price = parseFloat(unit_price);
    if (isNaN(cost)  || cost  < 0) return res.status(400).json({ error: 'unit_cost must be a non-negative number.' });
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'unit_price must be a non-negative number.' });

    if (!req.companyId)
      return res.status(400).json({ error: 'Cannot create product without a company context.' });

    const product = await prisma.product.create({
      data: {
        company_id:          req.companyId,
        name:                name.trim(),
        sku:                 sku.trim().toUpperCase(),
        unit_cost:           cost,
        unit_price:          price,
        low_stock_threshold: parseInt(low_stock_threshold ?? 10, 10),
        quantity_in_stock:   0,
      }
    });
    res.status(201).json(product);
  } catch (error) {
    console.error('[POST /products]', error);
    if (error.code === 'P2002')
      return res.status(409).json({ error: 'A product with this SKU already exists.' });
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

// PUT /products/:id — update product details (never touch quantity_in_stock directly)
// super_admin, admin, manager
router.put('/:id', authenticateToken, can('products', 'write'), async (req, res) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, ...co(req) }
    });
    if (!existing)
      return res.status(404).json({ error: 'Product not found.' });

    const { name, sku, unit_cost, unit_price, low_stock_threshold, is_active } = req.body;
    const data = {};
    if (name                !== undefined) data.name                = name.trim();
    if (sku                 !== undefined) data.sku                 = sku.trim().toUpperCase();
    if (unit_cost           !== undefined) data.unit_cost           = parseFloat(unit_cost);
    if (unit_price          !== undefined) data.unit_price          = parseFloat(unit_price);
    if (low_stock_threshold !== undefined) data.low_stock_threshold = parseInt(low_stock_threshold, 10);
    if (is_active           !== undefined) data.is_active           = Boolean(is_active);

    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  } catch (error) {
    console.error('[PUT /products/:id]', error);
    if (error.code === 'P2002')
      return res.status(409).json({ error: 'SKU already in use by another product.' });
    if (error.code === 'P2025')
      return res.status(404).json({ error: 'Product not found.' });
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// DELETE /products/:id — soft-deactivate
// super_admin, admin (managers can create/edit but not deactivate)
router.delete('/:id', authenticateToken, can('products', 'delete'), async (req, res) => {
  try {
    // Per spec: deactivation is admin/super_admin only
    if (req.user.role === 'manager')
      return res.status(403).json({ error: 'Managers cannot deactivate products. Contact an admin.' });

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, ...co(req) }
    });
    if (!existing)
      return res.status(404).json({ error: 'Product not found.' });

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data:  { is_active: false },
    });
    res.json({ message: `${product.name} deactivated.`, product });
  } catch (error) {
    console.error('[DELETE /products/:id]', error);
    res.status(500).json({ error: 'Failed to deactivate product.' });
  }
});

module.exports = router;
