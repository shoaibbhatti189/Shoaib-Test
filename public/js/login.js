// Redirect if already logged in
if (getToken()) window.location.href = '/dashboard.html';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const errEl = document.getElementById('errorMsg');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errEl.textContent = '';

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Login failed. Check your credentials.';
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }

    // Decode JWT to get employee_id
    const payload = decodeJWT(data.token);

    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('username', username);
    if (payload.employee_id) localStorage.setItem('employee_id', payload.employee_id);

    window.location.href = '/dashboard.html';
  } catch (err) {
    errEl.textContent = 'Cannot reach server. Is it running?';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});
