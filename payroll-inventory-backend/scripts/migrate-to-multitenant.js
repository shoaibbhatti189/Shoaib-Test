/**
 * scripts/migrate-to-multitenant.js
 *
 * One-time idempotent migration script.
 * Run AFTER `prisma db push` has applied the new schema.
 *
 * What it does:
 *  1. Creates a "Default" company (skips if already exists)
 *  2. Assigns all existing rows with NULL company_id to that company
 *  3. Migrates any legacy role="staff" → role="employee"
 *
 * Usage:
 *   node scripts/migrate-to-multitenant.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log(' PayrollPro — Multi-Tenant Migration');
  console.log('═══════════════════════════════════════════\n');

  // ── 1. Create or find the Default company ────────────────────────
  let company = await prisma.company.findFirst({ where: { name: 'Default' } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'Default', is_active: true }
    });
    console.log(`✅ Created company "Default"   id: ${company.id}`);
  } else {
    console.log(`ℹ️  Company "Default" already exists  id: ${company.id}`);
  }

  const cid = company.id;

  // ── 2. Backfill users (skip super_admin — they stay NULL) ─────────
  const u = await prisma.user.updateMany({
    where: { company_id: null, role: { not: 'super_admin' } },
    data:  { company_id: cid }
  });
  console.log(`✅ Users backfilled        → ${u.count} rows`);

  // ── 3. Migrate legacy role "staff" → "employee" ───────────────────
  const s = await prisma.user.updateMany({
    where: { role: 'staff' },
    data:  { role: 'employee' }
  });
  console.log(`✅ role "staff"→"employee"  → ${s.count} rows`);

  // ── 4. Backfill employees ─────────────────────────────────────────
  const e = await prisma.employee.updateMany({
    where: { company_id: null },
    data:  { company_id: cid }
  });
  console.log(`✅ Employees backfilled     → ${e.count} rows`);

  // ── 5. Backfill products ──────────────────────────────────────────
  const p = await prisma.product.updateMany({
    where: { company_id: null },
    data:  { company_id: cid }
  });
  console.log(`✅ Products backfilled      → ${p.count} rows`);

  // ── 6. Backfill attendance ────────────────────────────────────────
  const a = await prisma.attendance.updateMany({
    where: { company_id: null },
    data:  { company_id: cid }
  });
  console.log(`✅ Attendance backfilled    → ${a.count} rows`);

  // ── 7. Backfill payroll_runs ──────────────────────────────────────
  const pr = await prisma.payrollRun.updateMany({
    where: { company_id: null },
    data:  { company_id: cid }
  });
  console.log(`✅ Payroll runs backfilled  → ${pr.count} rows`);

  // ── 8. Backfill inventory_transactions ───────────────────────────
  const it = await prisma.inventoryTransaction.updateMany({
    where: { company_id: null },
    data:  { company_id: cid }
  });
  console.log(`✅ Inv. transactions backfilled → ${it.count} rows`);

  console.log('\n═══════════════════════════════════════════');
  console.log(' Migration complete!');
  console.log(`\n All existing data → company "Default" (${cid})`);
  console.log(' Login again to get a new JWT with company_id embedded.');
  console.log('═══════════════════════════════════════════');
}

main()
  .catch(err => {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
