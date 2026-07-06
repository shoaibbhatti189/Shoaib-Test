require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');

// Import routes
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const payrollRoutes = require('./routes/payroll');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/login', (req, res, next) => {
  // Mount the login route directly on /login instead of /auth/login based on prompt requirement
  if (req.path === '/' && req.method === 'POST') {
     return authRoutes(req, res, next);
  }
  next();
});
app.use('/logout', (req, res, next) => {
  if (req.path === '/' && req.method === 'POST') {
    return authRoutes(req, res, next); // Assuming we refactored auth to handle /login and /logout at root, but I mounted them inside auth.js as /login and /logout
  }
  next();
});

// To strictly follow the requested paths (/login, /logout instead of /auth/login)
app.post('/login', authRoutes.stack.find(layer => layer.route && layer.route.path === '/login').route.stack[0].handle);
app.post('/logout', authRoutes.stack.find(layer => layer.route && layer.route.path === '/logout').route.stack[0].handle);
app.post('/setup-admin', authRoutes.stack.find(layer => layer.route && layer.route.path === '/setup-admin').route.stack[0].handle);

app.use('/employees', employeeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/products', productRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/payroll', payrollRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
