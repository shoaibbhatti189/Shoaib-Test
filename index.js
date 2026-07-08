require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const payrollRoutes = require('./routes/payroll');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mount auth routes directly at root paths as specified
const authRouter = authRoutes;
app.use('/auth', authRouter);

// Expose /login and /logout directly at root (proxy to auth router)
app.post('/login', (req, res, next) => {
  req.url = '/login';
  authRouter(req, res, next);
});
app.post('/logout', (req, res, next) => {
  req.url = '/logout';
  authRouter(req, res, next);
});
app.post('/setup-admin', (req, res, next) => {
  req.url = '/setup-admin';
  authRouter(req, res, next);
});

app.use('/employees', employeeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/products', productRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/payroll', payrollRoutes);

app.get('/health', async (req, res) => {
  try {
    // Verify DB connection is alive
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date() });
  } catch (e) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Supabase project: evzurnvoqjwresnlepvc`);
});
