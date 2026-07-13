requireAuth();
renderSidebar();

async function loadDashboard() {
  const role = getRole();

  // Employees count (admin only — route requires admin)
  if (role === 'admin') {
    const r = await apiFetch('/employees');
    if (r) {
      const employees = await r.json();
      document.getElementById('statEmployees').textContent = employees.length;
    }
  } else {
    document.getElementById('statEmployees').textContent = '—';
  }

  // Products
  const rp = await apiFetch('/products');
  if (rp) {
    const products = await rp.json();
    document.getElementById('statProducts').textContent = products.length;
  }

  // Low stock
  const rls = await apiFetch('/products/low-stock');
  if (rls) {
    const lowStock = await rls.json();
    document.getElementById('statLowStock').textContent = lowStock.length;

    if (lowStock.length > 0) {
      const names = lowStock.slice(0, 3).map(p => p.name).join(', ');
      const more  = lowStock.length > 3 ? ` and ${lowStock.length - 3} more` : '';
      document.getElementById('lowStockAlert').innerHTML = `
        <div class="alert alert-warning" style="margin-bottom:20px;">
          ⚠️ <strong>${lowStock.length} item${lowStock.length > 1 ? 's' : ''} running low:</strong> ${names}${more}.
          <a href="/products.html" style="text-decoration:underline;margin-left:8px;">View products →</a>
        </div>`;
    }
  }

  // Recent transactions
  const rt = await apiFetch('/inventory/transactions');
  const tbody = document.getElementById('recentTxns');
  if (rt) {
    const txns = await rt.json();
    const today = txns.filter(t => {
      const d = new Date(t.date);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    });
    document.getElementById('statTxns').textContent = today.length;

    if (!txns.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🔄</div><p>No transactions yet</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = txns.slice(0, 8).map(t => {
      const sign   = t.change_amount > 0 ? '+' : '';
      const cls    = t.change_amount > 0 ? 'badge-green' : 'badge-red';
      const reason = { sale: 'badge-indigo', restock: 'badge-green', damage: 'badge-red', adjustment: 'badge-yellow' }[t.reason] || 'badge-gray';
      return `<tr>
        <td class="td-mono">${t.product_id.slice(0, 8)}…</td>
        <td><span class="badge ${cls}">${sign}${t.change_amount}</span></td>
        <td><span class="badge ${reason}">${t.reason}</span></td>
        <td class="td-muted">${fmtDT(t.date)}</td>
      </tr>`;
    }).join('');
  }
}

loadDashboard();
