const { PrismaClient } = require('@prisma/client');

// Singleton PrismaClient — prevents connection pool exhaustion
// when multiple route files import this module
const prisma = new PrismaClient();

module.exports = prisma;
