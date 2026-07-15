const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('=== Starting Cross-Company Isolation Test ===');
  
  // 1. Create two companies via Prisma
  const c1 = await prisma.company.create({ data: { name: 'Alpha Corp' } });
  const c2 = await prisma.company.create({ data: { name: 'Beta LLC' } });
  console.log(`[+] Created companies: ${c1.name}, ${c2.name}`);

  // 2. Create admins for each
  const hash = await bcrypt.hash('password123', 10);
  const admin1 = await prisma.user.create({
    data: { username: 'alpha_admin', password_hash: hash, role: 'admin', company_id: c1.id }
  });
  const admin2 = await prisma.user.create({
    data: { username: 'beta_admin', password_hash: hash, role: 'admin', company_id: c2.id }
  });
  console.log('[+] Created admins: alpha_admin, beta_admin');

  // 3. Login to get tokens
  const login = async (username, password) => {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    return data.token;
  };
  const token1 = await login('alpha_admin', 'password123');
  const token2 = await login('beta_admin', 'password123');

  // 4. Admin 1 creates a product
  await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ name: 'Alpha Product', sku: 'ALPH01', unit_cost: 10, unit_price: 20 })
  });

  // 5. Admin 2 creates a product
  await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
    body: JSON.stringify({ name: 'Beta Product', sku: 'BETA01', unit_cost: 15, unit_price: 25 })
  });
  
  console.log('[+] Products created for both companies.');

  // 6. Verify Isolation
  const getProducts = async (token) => {
    const res = await fetch(`${BASE_URL}/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return await res.json();
  };

  const prods1 = await getProducts(token1);
  const prods2 = await getProducts(token2);

  if (prods1.length === 1 && prods1[0].name === 'Alpha Product' &&
      prods2.length === 1 && prods2[0].name === 'Beta Product') {
    console.log('✅ ISOLATION TEST PASSED: Admins only see products from their own company.');
  } else {
    console.log('❌ ISOLATION TEST FAILED.');
    console.log('Alpha sees:', prods1.map(p => p.name));
    console.log('Beta sees:', prods2.map(p => p.name));
  }

  // Cleanup
  await prisma.product.deleteMany({ where: { company_id: { in: [c1.id, c2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [admin1.id, admin2.id] } } });
  await prisma.company.deleteMany({ where: { id: { in: [c1.id, c2.id] } } });
  console.log('[+] Cleanup complete.');
}

runTest().catch(e => {
  console.error(e);
}).finally(async () => {
  await prisma.$disconnect();
});
