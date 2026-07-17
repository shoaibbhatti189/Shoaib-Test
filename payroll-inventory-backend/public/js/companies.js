requireAuth();
renderSidebar();

const myRole = getRole();

if (myRole === 'super_admin') {
  document.getElementById('addCompanyBtn').style.display = 'inline-block';
}

function toggleForm() {
  const f = document.getElementById('addForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function loadCompanies() {
  const res = await apiFetch('/companies');
  if (!res) return;
  const companies = await res.json();
  
  const tbody = document.getElementById('companiesTable');
  if (!companies.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>No companies found.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = companies.map(c => {
    let actionBtn = '';
    if (myRole === 'super_admin') {
      actionBtn = `<button class="btn btn-danger-soft btn-sm" onclick="deleteCompany('${c.id}', '${c.name}')">Deactivate</button>`;
    }
    
    return `<tr>
      <td class="td-mono">${c.id}</td>
      <td><strong>${c.name}</strong></td>
      <td><span class="badge ${c.is_active ? 'badge-green' : 'badge-gray'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${fmtDate(c.created_at)}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
}

async function addCompany() {
  const name = document.getElementById('cName').value.trim();
  if (!name) return showToast('Company name is required.', 'warning');

  const res = await apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify({ name })
  });

  if (res && res.ok) {
    showToast('Company created successfully!');
    toggleForm();
    document.getElementById('cName').value = '';
    loadCompanies();
  } else if (res) {
    const err = await res.json();
    showToast(err.error || 'Failed to create company.', 'error');
  }
}

async function deleteCompany(id, name) {
  if (!confirm(`Are you sure you want to deactivate company "${name}"?`)) return;
  const res = await apiFetch(`/companies/${id}`, { method: 'DELETE' });
  if (res && res.ok) {
    showToast(`Company ${name} deactivated.`);
    loadCompanies();
  } else if (res) {
    const err = await res.json();
    showToast(err.error || 'Failed to deactivate company.', 'error');
  }
}

loadCompanies();
