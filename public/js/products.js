requireAuth();
renderSidebar();

const role = getRole();
if (role === 'admin') {
  document.getElementById('addBtn').style.display = 'inline-flex';
}

function toggleForm() {
  const f = document.getElementById('addForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function loadProducts() {
  const [rp, rls] = await Promise.all([apiFetch('/products'), apiFetch('/products/low-stock')]);
  if (!rp) return;

  const products = await rp.json();
  const lowStock = rls ? await rls.json() : [];
  const lowIds   = new Set(lowStock.map(p => p.id));

  // Low stock banner
  if (lowStock.length > 0) {
    document.getElementById('lowStockBanner').innerHTML = `
      <div class="alert alert-warning" style="margin-bottom:20px;">
        ⚠️ <strong>${lowStock.length} product${lowStock.length > 1 ? 's are' : ' is'} at or below their low-stock threshold:</strong>
        ${lowStock.map(p => `<span class="badge badge-yellow" style="margin-left:6px;">${p.name} (${p.quantity_in_stock})</span>`).join('')}
      </div>`;
  } else {
    document.getElementById('lowStockBanner').innerHTML = '';
  }

  const tbody = document.getElementById('productsTable');

  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>No products yet${role === 'admin' ? ' — add one above.' : '.'}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const isLow   = lowIds.has(p.id);
    const stockBadge = isLow
      ? `<span class="badge badge-red">${p.quantity_in_stock}</span>`
      : `<span class="badge badge-green">${p.quantity_in_stock}</span>`;
    const actionBtn = role === 'admin'
      ? `<button class="btn btn-danger-soft btn-sm" onclick="deactivate('${p.id}', '${p.name.replace(/'/g,"\\'")}')">Deactivate</button>`
      : '';
    return `<tr>
      <td><strong>${p.name}</strong></td>
      <td class="td-mono">${p.sku}</td>
      <td>${stockBadge} <span class="td-muted">/ ${p.low_stock_threshold} min</span></td>
      <td class="td-muted">${fmt$(p.unit_cost)}</td>
      <td>${fmt$(p.unit_price)}</td>
      <td><span class="badge ${p.is_active ? 'badge-green' : 'badge-gray'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
}

async function addProduct() {
  const name               = document.getElementById('pName').value.trim();
  const sku                = document.getElementById('pSku').value.trim();
  const unit_cost          = parseFloat(document.getElementById('pCost').value);
  const unit_price         = parseFloat(document.getElementById('pPrice').value);
  const low_stock_threshold = parseInt(document.getElementById('pThreshold').value || '10', 10);

  if (!name || !sku || isNaN(unit_cost) || isNaN(unit_price)) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  const r = await apiFetch('/products', {
    method: 'POST',
    body: JSON.stringify({ name, sku, unit_cost, unit_price, low_stock_threshold }),
  });
  if (!r) return;

  if (r.ok) {
    showToast(`${name} added!`);
    document.getElementById('addForm').style.display = 'none';
    ['pName','pSku','pCost','pPrice','pThreshold'].forEach(id => document.getElementById(id).value = '');
    loadProducts();
  } else {
    const d = await r.json();
    showToast(d.error || 'Failed to create product.', 'error');
  }
}

async function deactivate(id, name) {
  if (!confirm(`Deactivate "${name}"? It will be hidden from the catalog.`)) return;
  const r = await apiFetch(`/products/${id}`, { method: 'DELETE' });
  if (r && r.ok) { showToast(`${name} deactivated.`, 'warning'); loadProducts(); }
}

loadProducts();
