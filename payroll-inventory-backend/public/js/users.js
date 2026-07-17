requireAuth();
renderSidebar();

const myRole = getRole();

if (myRole !== 'super_admin' && myRole !== 'admin') {
  document.querySelector('.page-header-row button').style.display = 'none';
}

if (myRole !== 'super_admin') {
  document.getElementById('companyField').style.display = 'none';
}

function toggleForm() {
  const f = document.getElementById('addForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

async function loadUsers() {
  const res = await apiFetch('/users');
  if (!res) return;
  const users = await res.json();
  
  const tbody = document.getElementById('usersTable');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>No users found.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    let actionBtn = '';
    if (['manager', 'admin', 'super_admin'].includes(u.role) && (myRole === 'super_admin' || myRole === 'admin')) {
      actionBtn += `<button class="btn btn-primary-soft btn-sm" onclick="promptPin('${u.id}', '${u.username}')" style="margin-right: 4px;">Set PIN</button>`;
    }
    if (myRole === 'super_admin' || myRole === 'admin') {
      actionBtn += `<button class="btn btn-danger-soft btn-sm" onclick="deleteUser('${u.id}', '${u.username}')">Delete</button>`;
    }
    
    return `<tr>
      <td><strong>${u.username}</strong></td>
      <td><span class="badge badge-gray">${u.role}</span></td>
      <td class="td-mono">${u.company_id || '—'}</td>
      <td class="td-mono">${u.employee_id || '—'}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
}

async function addUser() {
  const username = document.getElementById('uName').value.trim();
  const password = document.getElementById('uPass').value;
  const role = document.getElementById('uRole').value;
  const company_id = document.getElementById('uCompany').value.trim();

  if (!username || !password || !role) {
    showToast('Username, password, and role are required.', 'warning');
    return;
  }

  const body = { username, password, role };
  if (myRole === 'super_admin' && company_id) {
    body.company_id = company_id;
  }

  const res = await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (res && res.ok) {
    showToast('User created successfully!');
    toggleForm();
    ['uName', 'uPass', 'uCompany'].forEach(id => document.getElementById(id).value = '');
    loadUsers();
  } else if (res) {
    const err = await res.json();
    showToast(err.error || 'Failed to create user.', 'error');
  }
}

async function deleteUser(id, name) {
  if (!confirm(`Are you sure you want to delete user "${name}"?`)) return;
  const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
  if (res && res.ok) {
    showToast(`User ${name} deleted.`);
    loadUsers();
  } else if (res) {
    const err = await res.json();
    showToast(err.error || 'Failed to delete user.', 'error');
  }
}

// PIN Modal logic
let pendingPinUserId = null;

function promptPin(id, username) {
  pendingPinUserId = id;
  document.getElementById('pinUserName').innerText = username;
  document.getElementById('newPin').value = '';
  document.getElementById('pinModal').style.display = 'block';
}

function cancelPin() {
  document.getElementById('pinModal').style.display = 'none';
  pendingPinUserId = null;
}

async function submitPin() {
  const pin = document.getElementById('newPin').value;
  if (!pin || pin.length < 4) {
    return showToast('PIN must be at least 4 characters long.', 'warning');
  }
  
  const res = await apiFetch(`/users/${pendingPinUserId}/set-pin`, {
    method: 'POST',
    body: JSON.stringify({ pin })
  });
  
  if (res && res.ok) {
    showToast('PIN set successfully!');
    cancelPin();
  } else if (res) {
    const err = await res.json();
    showToast(err.error || 'Failed to set PIN.', 'error');
  }
}

loadUsers();
