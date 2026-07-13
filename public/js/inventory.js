requireAuth();
renderSidebar();

let productMap = {}; // id → name

async function init() {
  const r = await apiFetch('/products');
  if (!r) return;
  const products = await r.json();

  productMap = {};
  products.forEach(p => { productMap[p.id] = p; });

  const opts = products.map(p => `<option value="${p.id}">${p.name} (${p.sku}) — ${p.quantity_in_stock} in stock</option>`).join('');
  document.getElementById('txnProduct').innerHTML = `<option value="">Select product…</option>${opts}`;
  document.getElementById('filterProduct').innerHTML = `<option value="">All Products</option>${products.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}`;

  loadTransactions();
}

async function recordTransaction() {
  const product_id    = document.getElementById('txnProduct').value;
  const reason        = document.getElementById('txnReason').value;
  const change_amount = parseInt(document.getElementById('txnAmt').value, 10);
  const resultEl      = document.getElementById('txnResult');

  if (!product_id) { showToast('Select a product.', 'warning'); return; }
  if (isNaN(change_amount) || change_amount === 0) { showToast('Enter a non-zero quantity.', 'warning'); return; }

  const r = await apiFetch('/inventory/transaction', {
    method: 'POST',
    body: JSON.stringify({ product_id, change_amount, reason }),
  });
  if (!r) return;

  if (r.ok) {
    const data = await r.json();
    const sign = change_amount > 0 ? '+' : '';
    resultEl.innerHTML = `<div class="alert alert-success">✓ Transaction recorded. New stock for <strong>${productMap[product_id]?.name || product_id}</strong>: <strong>${data.newStock} units</strong></div>`;
    document.getElementById('txnAmt').value = '';
    document.getElementById('txnProduct').value = '';
    // Refresh product map and transaction log
    await init();
  } else {
    const d = await r.json();
    resultEl.innerHTML = `<div class="alert alert-danger">✗ ${d.error || 'Failed to record transaction.'}</div>`;
  }
}

async function loadTransactions() {
  const tbody     = document.getElementById('txnTable');
  const productId = document.getElementById('filterProduct').value;
  const url       = productId ? `/inventory/transactions?product_id=${productId}` : '/inventory/transactions';

  tbody.innerHTML = `<tr class="loading-row"><td colspan="5">Loading…</td></tr>`;
  const r = await apiFetch(url);
  if (!r) return;
  const txns = await r.json();

  if (!txns.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🔄</div><p>No transactions recorded yet.</p></div></td></tr>`;
    return;
  }

  const REASON_BADGE = { sale: 'badge-indigo', restock: 'badge-green', damage: 'badge-red', adjustment: 'badge-yellow' };

  tbody.innerHTML = txns.map(t => {
    const sign    = t.change_amount > 0 ? '+' : '';
    const amtCls  = t.change_amount > 0 ? 'badge-green' : 'badge-red';
    const pName   = productMap[t.product_id]?.name || t.product_id.slice(0,8) + '…';
    return `<tr>
      <td><strong>${pName}</strong></td>
      <td><span class="badge ${amtCls}">${sign}${t.change_amount}</span></td>
      <td><span class="badge ${REASON_BADGE[t.reason] || 'badge-gray'}">${t.reason}</span></td>
      <td class="td-muted">${productMap[t.product_id]?.quantity_in_stock ?? '—'}</td>
      <td class="td-muted">${fmtDT(t.date)}</td>
    </tr>`;
  }).join('');
}

init();
