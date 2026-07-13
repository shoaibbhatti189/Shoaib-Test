requireAuth();
renderSidebar();

const role = getRole();

// Set default date to today
document.getElementById('attDate').valueAsDate = new Date();

if (role === 'admin') {
  document.getElementById('empSelectGroup').style.display = 'flex';
  document.getElementById('adminFilter').style.display = 'block';
  loadEmployeeDropdowns();
} else {
  // Staff: auto-load own records
  loadRecords();
}

async function loadEmployeeDropdowns() {
  const r = await apiFetch('/employees');
  if (!r) return;
  const employees = await r.json();

  const opts = employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  document.getElementById('attEmp').innerHTML = `<option value="">Select employee…</option>${opts}`;
  document.getElementById('filterEmp').innerHTML = `<option value="">Select employee…</option>${opts}`;
}

async function logAttendance() {
  const date        = document.getElementById('attDate').value;
  const hours_worked = parseFloat(document.getElementById('attHours').value);

  let employee_id = null;
  if (role === 'admin') {
    employee_id = document.getElementById('attEmp').value;
    if (!employee_id) { showToast('Select an employee.', 'warning'); return; }
  }

  if (!date) { showToast('Please pick a date.', 'warning'); return; }
  if (isNaN(hours_worked) || hours_worked < 0 || hours_worked > 24) {
    showToast('Hours must be between 0 and 24.', 'warning');
    return;
  }

  const body = { date, hours_worked };
  if (employee_id) body.employee_id = employee_id;

  const r = await apiFetch('/attendance', { method: 'POST', body: JSON.stringify(body) });
  if (!r) return;
  if (r.ok) {
    showToast('Attendance logged!');
    document.getElementById('attHours').value = '';
    loadRecords();
  } else {
    const d = await r.json();
    showToast(d.error || 'Failed to log attendance.', 'error');
  }
}

async function loadRecords() {
  const tbody = document.getElementById('attTable');
  let empId;

  if (role === 'admin') {
    empId = document.getElementById('filterEmp').value;
    if (!empId) {
      tbody.innerHTML = `<tr class="loading-row"><td colspan="3">Select an employee to view records.</td></tr>`;
      return;
    }
  } else {
    empId = getEmpId();
    if (!empId) {
      tbody.innerHTML = `<tr class="loading-row"><td colspan="3">No employee record linked to your account.</td></tr>`;
      return;
    }
  }

  tbody.innerHTML = `<tr class="loading-row"><td colspan="3">Loading…</td></tr>`;
  const r = await apiFetch(`/attendance/${empId}`);
  if (!r) return;
  const records = await r.json();

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">📋</div><p>No attendance records found.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(rec => `
    <tr>
      <td><strong>${fmtDate(rec.date)}</strong></td>
      <td><span class="badge badge-indigo">${parseFloat(rec.hours_worked)} hrs</span></td>
      <td class="td-muted">${fmtDT(rec.created_at)}</td>
    </tr>`).join('');
}
