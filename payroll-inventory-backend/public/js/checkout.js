requireAuth();
renderSidebar();

let cartItems = [];
let pendingAction = null;
let pendingItemId = null;
let currentOverrideToken = null;

async function loadCart() {
  const res = await apiFetch('/checkout/cart');
  if (!res) return;
  cartItems = await res.json();
  renderCart();
}

function renderCart() {
  const tb = document.getElementById('cartTable');
  if (!cartItems || cartItems.length === 0) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cart is empty.</td></tr>';
    return;
  }

  let html = '';
  let total = 0;

  cartItems.forEach(item => {
    const sub = item.quantity * item.product.unit_price;
    total += sub;
    html += `
      <tr>
        <td>${item.product.name}</td>
        <td>${item.product.sku}</td>
        <td>${item.quantity}</td>
        <td>${fmt$(item.product.unit_price)}</td>
        <td>${fmt$(sub)}</td>
        <td style="text-align:right;">
          <button class="btn btn-outline" style="color:#dc3545;border-color:#dc3545;padding:4px 8px;" onclick="attemptRemove('${item.id}')">Remove</button>
        </td>
      </tr>
    `;
  });
  
  html += `
    <tr style="font-weight:bold; background-color:#f8f9fa;">
      <td colspan="4" style="text-align:right;">Total:</td>
      <td>${fmt$(total)}</td>
      <td></td>
    </tr>
  `;

  tb.innerHTML = html;
}

async function attemptRemove(id) {
  const role = getRole();
  if (['manager', 'admin', 'super_admin'].includes(role)) {
    // Can do directly
    await executeRemove(id, null);
  } else {
    // Requires override
    pendingAction = 'remove_item';
    pendingItemId = id;
    showOverrideModal('remove_item');
  }
}

async function executeRemove(id, token) {
  const headers = token ? { 'X-Override-Token': token } : {};
  const res = await apiFetch(`/checkout/cart/${id}`, { method: 'DELETE', headers });
  if (res && res.ok) {
    showToast('Item removed.');
    loadCart();
  }
}

async function finalizeCheckout() {
  if (cartItems.length === 0) return showToast('Cart is empty.', 'error');
  
  const role = getRole();
  if (['manager', 'admin', 'super_admin'].includes(role)) {
    await executeFinalize(null);
  } else {
    pendingAction = 'finalize_bill';
    showOverrideModal('finalize_bill');
  }
}

async function executeFinalize(token) {
  const headers = token ? { 'X-Override-Token': token } : {};
  const res = await apiFetch('/checkout/finalize', { method: 'POST', headers });
  if (res && res.ok) {
    showToast('Checkout finalized successfully.');
    loadCart();
  }
}

function showOverrideModal(action) {
  document.getElementById('overrideAction').innerText = action;
  document.getElementById('overridePin').value = '';
  document.getElementById('overrideModal').style.display = 'block';
}

function cancelOverride() {
  document.getElementById('overrideModal').style.display = 'none';
  pendingAction = null;
  pendingItemId = null;
}

async function submitOverride() {
  const pin = document.getElementById('overridePin').value;
  if (!pin) return showToast('Please enter a PIN.', 'error');

  const res = await apiFetch('/checkout/override', {
    method: 'POST',
    body: JSON.stringify({ pin, action: pendingAction })
  });

  if (res && res.ok) {
    const data = await res.json();
    currentOverrideToken = data.override_token;
    
    // Proceed with action
    if (pendingAction === 'remove_item') {
      await executeRemove(pendingItemId, currentOverrideToken);
    } else if (pendingAction === 'finalize_bill') {
      await executeFinalize(currentOverrideToken);
    }
    
    cancelOverride();
  } else if (res) {
    const err = await res.json();
    showToast(err.error || 'Invalid PIN.', 'error');
  }
}

// Load initially
loadCart();
