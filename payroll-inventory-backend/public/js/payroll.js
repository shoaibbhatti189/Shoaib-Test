requireAdmin(); // Only admins can access payroll
renderSidebar();

async function runPayroll() {
  const period_start       = document.getElementById('prStart').value;
  const period_end         = document.getElementById('prEnd').value;
  const standard_deduction = parseFloat(document.getElementById('prDeduct').value || '0');
  const resultEl           = document.getElementById('runResult');

  if (!period_start || !period_end) { showToast('Select both start and end dates.', 'warning'); return; }
  if (new Date(period_start) > new Date(period_end)) { showToast('Start date must be before end date.', 'warning'); return; }

  resultEl.innerHTML = `<div class="alert alert-info" style="margin-bottom:20px;">⏳ Running payroll…</div>`;

  const r = await apiFetch('/payroll/run', {
    method: 'POST',
    body: JSON.stringify({ period_start, period_end, standard_deduction }),
  });
  if (!r) { resultEl.innerHTML = ''; return; }

  if (r.ok) {
    const data = await r.json();
    const { paychecks } = data;
    const totalNet = paychecks.reduce((s, p) => s + parseFloat(p.net_pay), 0);

    resultEl.innerHTML = `
      <div class="card section">
        <div class="card-title">Payroll Run Complete — ${fmtDate(period_start)} to ${fmtDate(period_end)}</div>
        <div class="stats-grid" style="margin-bottom:16px;">
          <div class="stat-card"><div class="stat-icon green">👤</div><div><div class="stat-label">Employees Paid</div><div class="stat-value">${paychecks.length}</div></div></div>
          <div class="stat-card"><div class="stat-icon indigo">💰</div><div><div class="stat-label">Total Payout</div><div class="stat-value">${fmt$(totalNet)}</div></div></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Gross Pay</th><th>Deductions</th><th>Net Pay</th></tr></thead>
            <tbody>
              ${paychecks.map(p => `<tr>
                <td class="td-muted">${p.employee_id.slice(0,8)}…</td>
                <td>${fmt$(p.gross_pay)}</td>
                <td class="td-muted">-${fmt$(p.deductions)}</td>
                <td><strong>${fmt$(p.net_pay)}</strong></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    showToast('Payroll completed!');
    loadRuns();
  } else {
    const d = await r.json();
    resultEl.innerHTML = `<div class="alert alert-danger" style="margin-bottom:20px;">✗ ${d.error || 'Payroll failed.'}</div>`;
  }
}

async function loadRuns() {
  const tbody = document.getElementById('runsTable');
  tbody.innerHTML = `<tr class="loading-row"><td colspan="5">Loading…</td></tr>`;

  const r = await apiFetch('/payroll/runs');
  if (!r) return;
  const runs = await r.json();

  if (!runs.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💰</div><p>No payroll runs yet — use the form above to run your first one.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = runs.map(run => `
    <tr>
      <td><strong>${fmtDate(run.period_start)}</strong> → ${fmtDate(run.period_end)}</td>
      <td><span class="badge ${run.status === 'finalized' ? 'badge-green' : 'badge-yellow'}">${run.status}</span></td>
      <td class="td-muted">${fmtDT(run.created_at)}</td>
      <td class="td-muted">—</td>
      <td><button class="btn btn-outline btn-sm" onclick="viewRun('${run.id}', '${fmtDate(run.period_start)} → ${fmtDate(run.period_end)}')">View</button></td>
    </tr>`).join('');
}

async function viewRun(id, label) {
  document.getElementById('paycheckDetail').style.display = 'block';
  document.getElementById('paycheckTitle').textContent = `Paychecks — ${label}`;
  document.getElementById('paycheckTable').innerHTML = `<tr class="loading-row"><td colspan="5">Loading…</td></tr>`;
  document.getElementById('paycheckDetail').scrollIntoView({ behavior: 'smooth' });

  const r = await apiFetch(`/payroll/runs/${id}`);
  if (!r) return;
  const run = await r.json();

  if (!run.paychecks || !run.paychecks.length) {
    document.getElementById('paycheckTable').innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>No paychecks in this run.</p></div></td></tr>`;
    return;
  }

  document.getElementById('paycheckTable').innerHTML = run.paychecks.map(p => `
    <tr>
      <td><strong>${p.employee?.name || 'Employee'}</strong><br><span class="td-muted">${p.employee?.role_title || ''}</span></td>
      <td class="td-muted">${fmt$(p.employee?.hourly_rate)}/hr</td>
      <td>${fmt$(p.gross_pay)}</td>
      <td class="td-muted">-${fmt$(p.deductions)}</td>
      <td><strong style="color:var(--success);">${fmt$(p.net_pay)}</strong></td>
    </tr>`).join('');
}

function closeDetail() {
  document.getElementById('paycheckDetail').style.display = 'none';
}

loadRuns();
