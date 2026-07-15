const express = require('express');
const crypto  = require('crypto');
const bcrypt  = require('bcrypt');
const prisma  = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { can } = require('../middleware/permissions');
const { requireOverrideOrElevated } = require('../middleware/override');

const router = express.Router();
const co = (req) => req.companyId ? { company_id: req.companyId } : {};

// GET /cart — list items in cart added by the current user
router.get('/cart', authenticateToken, can('cart', 'read', { allowOwn: true }), async (req, res) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: {
        added_by_user_id: req.user.id,
        ...co(req)
      },
      include: { product: true },
      orderBy: { created_at: 'asc' }
    });
    res.json(items);
  } catch (error) {
    console.error('[GET /cart]', error);
    res.status(500).json({ error: 'Failed to fetch cart items.' });
  }
});

// POST /cart — add a product to the cart
router.post('/cart', authenticateToken, can('cart', 'write'), async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    if (!product_id || quantity === undefined || quantity <= 0) {
      return res.status(400).json({ error: 'product_id and a positive quantity are required.' });
    }

    const product = await prisma.product.findFirst({
      where: { id: product_id, ...co(req) }
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    // Upsert equivalent: check if already in cart
    const existing = await prisma.cartItem.findFirst({
      where: {
        product_id,
        added_by_user_id: req.user.id,
        ...co(req)
      }
    });

    if (existing) {
      const updated = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity }
      });
      return res.json(updated);
    }

    const item = await prisma.cartItem.create({
      data: {
        company_id: req.companyId,
        product_id,
        quantity,
        added_by_user_id: req.user.id
      }
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('[POST /cart]', error);
    res.status(500).json({ error: 'Failed to add item to cart.' });
  }
});

// DELETE /cart/:id — remove item from cart. Requires override if role is employee.
router.delete('/cart/:id', authenticateToken, can('cart', 'write'), requireOverrideOrElevated('remove_item'), async (req, res) => {
  try {
    const item = await prisma.cartItem.findFirst({
      where: {
        id: req.params.id,
        added_by_user_id: req.user.id,
        ...co(req)
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    await prisma.cartItem.delete({ where: { id: item.id } });
    res.json({ message: 'Item removed.' });
  } catch (error) {
    console.error('[DELETE /cart/:id]', error);
    res.status(500).json({ error: 'Failed to remove cart item.' });
  }
});

// POST /override — request an override token by supplying a manager's PIN
// The employee provides `pin` and `action`.
router.post('/override', authenticateToken, async (req, res) => {
  try {
    const { pin, action } = req.body;
    
    if (!pin || !action) {
      return res.status(400).json({ error: 'pin and action are required.' });
    }

    if (!['remove_item', 'finalize_bill'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action.' });
    }

    // Find all managers/admins/super_admins in the same company that have a PIN set
    const managers = await prisma.user.findMany({
      where: {
        ...co(req),
        role: { in: ['manager', 'admin', 'super_admin'] },
        pin_code_hash: { not: null }
      }
    });

    let authorizedManager = null;
    for (const manager of managers) {
      const isValid = await bcrypt.compare(pin, manager.pin_code_hash);
      if (isValid) {
        authorizedManager = manager;
        break;
      }
    }

    if (!authorizedManager) {
      return res.status(401).json({ error: 'Invalid PIN.' });
    }

    // Generate a secure, single-use token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Token expires in 2 minutes
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await prisma.checkoutOverride.create({
      data: {
        company_id: req.companyId,
        requested_by_user_id: req.user.id,
        authorized_by_user_id: authorizedManager.id,
        action,
        override_token_hash: tokenHash,
        expires_at: expiresAt
      }
    });

    res.json({ override_token: token, expires_in_seconds: 120 });
  } catch (error) {
    console.error('[POST /override]', error);
    res.status(500).json({ error: 'Failed to generate override token.' });
  }
});

// POST /finalize — convert cart to inventory transactions. Requires override if employee.
router.post('/finalize', authenticateToken, can('cart', 'write'), requireOverrideOrElevated('finalize_bill'), async (req, res) => {
  try {
    const items = await prisma.cartItem.findMany({
      where: {
        added_by_user_id: req.user.id,
        ...co(req)
      },
      include: { product: true }
    });

    if (items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const transactions = [];
      for (const item of items) {
        // Create an inventory transaction (negative amount for sale)
        const transaction = await tx.inventoryTransaction.create({
          data: {
            company_id: req.companyId,
            product_id: item.product_id,
            change_amount: -item.quantity,
            reason: 'sale',
            employee_id: req.user.employee_id
          }
        });
        transactions.push(transaction);

        // Update product stock directly in the transaction
        await tx.product.update({
          where: { id: item.product_id },
          data: { quantity_in_stock: { decrement: item.quantity } }
        });
      }

      // Empty the user's cart
      await tx.cartItem.deleteMany({
        where: { added_by_user_id: req.user.id }
      });

      return transactions;
    });

    res.json({ message: 'Checkout successful.', transactions: result });
  } catch (error) {
    console.error('[POST /finalize]', error);
    res.status(500).json({ error: 'Failed to finalize checkout.' });
  }
});

module.exports = router;
