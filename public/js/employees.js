requireAuth();
renderSidebar();

const role = getRole();

if (role === 'admin') {
  document.getElementById('adminView').style.display = 'block';
  loadEmployees();
} else {
  document.getElementById('staffView').style.display = 'block';
  loadProfile();
}

function toggleForm() {
  const f   = document.getElementById('addForm');
  const open = f.style.display === 'none';
  f.style.display = open ? 'block' : 'none';
  clearFormError();
  if (!open) {
    // Reset fields when closing
    ['empName', 'empRole', 'empRate', 'empHire'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }
}

function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.style.display = 'flex';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFormError() {
  const el = document.getElementById('formError');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

async function loadEmployees() {
  const r = await apiFetch('/employees');
  if (!r) return;

  if (!r.ok) {
    const d = await r.json();
    showToast(d.error || 'Failed to load employees.', 'error');
    return;
  }

  const employees = await r.json();
  const tbody = document.getElementById('empTable');

  if (!employees.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>No employees yet — add one above.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = employees.map(e => `
    <tr>
      <td><strong>${escHtml(e.name)}</strong></td>
      <td class="td-muted">${escHtml(e.role_title)}</td>
      <td>${fmt$(e.hourly_rate)}<span class="td-muted">/hr</span></td>
      <td class="td-muted">${fmtDate(e.hire_date)}</td>
      <td><span class="badge ${e.is_active ? 'badge-green' : 'badge-gray'}">${e.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        ${e.is_active
          ? `<button class="btn btn-danger-soft btn-sm" onclick="deactivate('${e.id}', '${escAttr(e.name)}')">Deactivate</button>`
          : '<span class="td-muted" style="font-size:12px;">Inactive</span>'}
      </td>
    </tr>`).join('');
}

async function addEmployee() {
  clearFormError();

  const name        = document.getElementById('empName').value.trim();
  const role_title  = document.getElementById('empRole').value.trim();
  const hourly_rate = document.getElementById('empRate').value.trim();
  const hire_date   = document.getElementById('empHire').value;

  // Client-side validation with specific messages
  if (!name)        { showFormError('Full Name is required.'); return; }
  if (!role_title)  { showFormError('Role / Job Title is required.'); return; }
  if (!hourly_rate || isNaN(parseFloat(hourly_rate)) || parseFloat(hourly_rate) < 0) {
    showFormError('Hourly Rate must be a valid positive number.'); return;
  }
  if (!hire_date)   { showFormError('Hire Date is required.'); return; }

  const btn = document.querySelector('#addForm .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const r = await apiFetch('/employees', {
    method: 'POST',
    body: JSON.stringify({
      name,
      role_title,
      hourly_rate: parseFloat(hourly_rate),
      hire_date
    }),
  });

  btn.disabled = false;
  btn.textContent = 'Create Employee';

  if (!r) return;

  if (r.ok) {
    showToast(`${name} added successfully!`);
    toggleForm();
    loadEmployees();
  } else {
    const d = await r.json();
    showFormError(d.error || 'Failed to add employee. Please try again.');
  }
}

async function deactivate(id, name) {
  if (!confirm(`Deactivate ${name}? They will no longer appear in payroll.`)) return;

  const r = await apiFetch(`/employees/${id}`, { method: 'DELETE' });
  if (!r) return;

  if (r.ok) {
    showToast(`${name} deactivated.`, 'warning');
    loadEmployees();
  } else {
    const d = await r.json();
    showToast(d.error || 'Failed to deactivate employee.', 'error');
  }
}

async function loadProfile() {
  const r = await apiFetch('/employees/me');
  if (!r) return;

  const profileEl = document.getElementById('profileCard');

  if (r.status === 404) {
    profileEl.innerHTML = `
      <div class="alert alert-info">
        ℹ️ Your account is not linked to an employee record. Ask your admin to link your login to an employee profile.
      </div>`;
    return;
  }

  if (!r.ok) {
    profileEl.innerHTML = `<div class="alert alert-danger">Failed to load your profile. Please refresh.</div>`;
    return;
  }

  const e = await r.json();
  profileEl.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${escHtml(e.name[0].toUpperCase())}</div>
      <div>
        <div class="profile-name">${escHtml(e.name)}</div>
        <div class="profile-role">${escHtml(e.role_title)}</div>
      </div>
    </div>
    <div class="detail-grid" style="margin-top:20px;">
      <div class="detail-item">
        <div class="detail-label">Hourly Rate</div>
        <div class="detail-value">${fmt$(e.hourly_rate)} / hr</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Hire Date</div>
        <div class="detail-value">${fmtDate(e.hire_date)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Status</div>
        <div class="detail-value">
          <span class="badge ${e.is_active ? 'badge-green' : 'badge-gray'}">${e.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
    </div>`;
}

// Utility: escape HTML in dynamic content to prevent XSS
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}
