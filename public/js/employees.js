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
  const f = document.getElementById('addForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function loadEmployees() {
  const r = await apiFetch('/employees');
  if (!r) return;
  const employees = await r.json();
  const tbody = document.getElementById('empTable');

  if (!employees.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>No employees yet — add one above.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = employees.map(e => `
    <tr>
      <td><strong>${e.name}</strong></td>
      <td class="td-muted">${e.role_title}</td>
      <td>${fmt$(e.hourly_rate)}<span class="td-muted">/hr</span></td>
      <td class="td-muted">${fmtDate(e.hire_date)}</td>
      <td><span class="badge ${e.is_active ? 'badge-green' : 'badge-gray'}">${e.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        ${e.is_active
          ? `<button class="btn btn-danger-soft btn-sm" onclick="deactivate('${e.id}', '${e.name}')">Deactivate</button>`
          : '<span class="td-muted" style="font-size:12px;">Inactive</span>'}
      </td>
    </tr>`).join('');
}

async function addEmployee() {
  const name       = document.getElementById('empName').value.trim();
  const role_title = document.getElementById('empRole').value.trim();
  const hourly_rate = parseFloat(document.getElementById('empRate').value);
  const hire_date  = document.getElementById('empHire').value;

  if (!name || !role_title || isNaN(hourly_rate) || !hire_date) {
    showToast('Please fill in all fields.', 'warning');
    return;
  }

  const r = await apiFetch('/employees', {
    method: 'POST',
    body: JSON.stringify({ name, role_title, hourly_rate, hire_date }),
  });

  if (!r) return;
  if (r.ok) {
    showToast(`${name} added successfully!`);
    document.getElementById('addForm').style.display = 'none';
    ['empName','empRole','empRate','empHire'].forEach(id => document.getElementById(id).value = '');
    loadEmployees();
  } else {
    const d = await r.json();
    showToast(d.error || 'Failed to add employee.', 'error');
  }
}

async function deactivate(id, name) {
  if (!confirm(`Deactivate ${name}? They will no longer appear in payroll.`)) return;
  const r = await apiFetch(`/employees/${id}`, { method: 'DELETE' });
  if (r && r.ok) {
    showToast(`${name} deactivated.`, 'warning');
    loadEmployees();
  }
}

async function loadProfile() {
  const r = await apiFetch('/employees/me');
  if (!r) return;
  if (r.status === 404) {
    document.getElementById('profileCard').innerHTML = `
      <div class="alert alert-info">Your account is not linked to an employee record. Ask your admin to link your login to an employee profile.</div>`;
    return;
  }
  const e = await r.json();
  document.getElementById('profileCard').innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${e.name[0]}</div>
      <div>
        <div class="profile-name">${e.name}</div>
        <div class="profile-role">${e.role_title}</div>
      </div>
    </div>
    <div class="detail-grid" style="margin-top:20px;">
      <div class="detail-item"><div class="detail-label">Hourly Rate</div><div class="detail-value">${fmt$(e.hourly_rate)} / hr</div></div>
      <div class="detail-item"><div class="detail-label">Hire Date</div><div class="detail-value">${fmtDate(e.hire_date)}</div></div>
      <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value"><span class="badge ${e.is_active ? 'badge-green' : 'badge-gray'}">${e.is_active ? 'Active' : 'Inactive'}</span></div></div>
    </div>`;
}
