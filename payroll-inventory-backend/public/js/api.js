/* ─────────────────────────────────────────────
   api.js — Auth helpers, fetch wrapper, sidebar
   ───────────────────────────────────────────── */

function getToken() {
  let token = localStorage.getItem('token');
  // Attempt to grab the latest token directly from Supabase's persisted storage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
      try {
        const session = JSON.parse(localStorage.getItem(key));
        if (session && session.access_token) {
          token = session.access_token;
        }
      } catch (e) {}
    }
  }
  return token;
}
function getRole()     { return localStorage.getItem('role'); }
function getUsername() { return localStorage.getItem('username'); }
function getEmpId()    { return localStorage.getItem('employee_id'); }

function redirectToLogin() {
  localStorage.clear();
  window.location.href = '/login.html';
}

function requireAuth() {
  if (!getToken()) redirectToLogin();
}

function requireAdmin() {
  requireAuth();
  if (getRole() !== 'admin') window.location.href = '/dashboard.html';
}

function decodeJWT(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return {}; }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (res.status === 401 || res.status === 403) { redirectToLogin(); return null; }
    return res;
  } catch (e) {
    showToast('Network error — is the server running?', 'error');
    return null;
  }
}

const NAV = [
  { href: '/dashboard.html',  icon: '⊞', label: 'Dashboard',  roles: ['super_admin', 'admin', 'hr', 'manager', 'employee', 'staff'] },
  { href: '/employees.html',  icon: '👥', label: 'Employees',  roles: ['super_admin', 'admin', 'hr', 'manager', 'employee', 'staff'] },
  { href: '/attendance.html', icon: '📋', label: 'Attendance', roles: ['super_admin', 'admin', 'hr', 'manager', 'employee', 'staff'] },
  { href: '/products.html',   icon: '📦', label: 'Products',   roles: ['super_admin', 'admin', 'hr', 'manager', 'employee', 'staff'] },
  { href: '/inventory.html',  icon: '🔄', label: 'Inventory',  roles: ['super_admin', 'admin', 'manager', 'staff'] },
  { href: '/payroll.html',    icon: '💰', label: 'Payroll',    roles: ['super_admin', 'admin', 'employee', 'staff'] },
  { href: '/checkout.html',   icon: '🛒', label: 'Checkout',   roles: ['super_admin', 'admin', 'hr', 'manager', 'employee', 'staff'] },
  { href: '/users.html',      icon: '⚙️', label: 'Users',      roles: ['super_admin', 'admin'] },
  { href: '/companies.html',  icon: '🏢', label: 'Companies',  roles: ['super_admin', 'admin'] },
];

function renderSidebar() {
  const role     = getRole() || '';
  const username = getUsername() || 'User';
  const current  = window.location.pathname;

  const links = NAV
    .filter(l => l.roles.includes(role))
    .map(l => `
      <a href="${l.href}" class="nav-link${current === l.href ? ' active' : ''}">
        <span class="nav-icon">${l.icon}</span>
        <span>${l.label}</span>
      </a>`).join('');

  const el = document.getElementById('sidebar');
  if (!el) return;
  el.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-logo">⚡</div>
      <div>
        <div class="brand-name">PayrollPro</div>
        <div class="brand-sub">Management System</div>
      </div>
    </div>
    <nav class="sidebar-nav">${links}</nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="user-avatar">${username[0].toUpperCase()}</div>
        <div>
          <div class="user-name">${username}</div>
          <div class="user-role"><span class="role-dot"></span>${role}</div>
        </div>
      </div>
      <button class="btn-logout" onclick="logout()">↩ Sign out</button>
    </div>`;
}

function logout() { localStorage.clear(); window.location.href = '/login.html'; }

/* ─── Toast ─── */
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

/* ─── Formatters ─── */
function fmt$(v)    { return '$' + parseFloat(v || 0).toFixed(2); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
function fmtDT(d)   { if (!d) return '—'; return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
