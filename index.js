require('dotenv').config();
const express = require('express');
const path    = require('path');
const prisma  = require('./lib/prisma');

// ── Routes ────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const employeeRoutes  = require('./routes/employees');
const attendanceRoutes= require('./routes/attendance');
const productRoutes   = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const payrollRoutes   = require('./routes/payroll');
const checkoutRoutes  = require('./routes/checkout');
// Phase 4 — added after Phase 3 approval
// const companyRoutes   = require('./routes/companies');
// const userRoutes      = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Root → redirect to login
app.get('/', (req, res) => res.redirect('/login.html'));

// ── Auth (no authentication required) ─────────────────────────────
app.use('/auth', authRoutes);
// Convenience top-level aliases so the frontend can POST /login, etc.
app.post('/login',       (req, res, next) => { req.url = '/login';       authRoutes(req, res, next); });
app.post('/logout',      (req, res, next) => { req.url = '/logout';      authRoutes(req, res, next); });
app.post('/setup-admin', (req, res, next) => { req.url = '/setup-admin'; authRoutes(req, res, next); });

// ── Protected API routes ───────────────────────────────────────────
// authenticateToken (inside each router) sets req.user + req.companyId
// so company scoping is automatically applied on every request.
app.use('/employees',  employeeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/products',   productRoutes);
app.use('/inventory',  inventoryRoutes);
app.use('/payroll',    payrollRoutes);
app.use('/checkout',   checkoutRoutes);  // Phase 3
// app.use('/companies',  companyRoutes);   // Phase 4
// app.use('/users',      userRoutes);      // Phase 4

// ── Health check ──────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status:    'ok',
      database:  'connected',
      timestamp: new Date()
    });
  } catch {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Unhandled error]', err.stack);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
