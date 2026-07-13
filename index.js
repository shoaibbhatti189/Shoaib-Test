require('dotenv').config();
const express = require('express');
const prisma = require('./lib/prisma');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const payrollRoutes = require('./routes/payroll');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Auth routes mounted both at /auth/* and at root /login, /logout, /setup-admin
app.use('/auth', authRoutes);
app.post('/login', (req, res, next) => { req.url = '/login'; authRoutes(req, res, next); });
app.post('/logout', (req, res, next) => { req.url = '/logout'; authRoutes(req, res, next); });
app.post('/setup-admin', (req, res, next) => { req.url = '/setup-admin'; authRoutes(req, res, next); });

app.use('/employees', employeeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/products', productRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/payroll', payrollRoutes);

// Health check — verifies live DB connection using shared singleton
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date() });
  } catch (e) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
