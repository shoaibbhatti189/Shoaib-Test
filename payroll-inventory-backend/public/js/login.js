// If they are already logged in, redirect
if (localStorage.getItem('token')) {
  window.location.href = '/dashboard.html';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const errEl = document.getElementById('errorMsg');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    errEl.textContent = 'Please enter both username and password.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errEl.textContent = '';

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    localStorage.setItem('token', data.token);
    if (data.role) localStorage.setItem('role', data.role);
    if (data.username) localStorage.setItem('username', data.username);
    if (data.company_id) localStorage.setItem('company_id', data.company_id);
    if (data.employee_id) localStorage.setItem('employee_id', data.employee_id);

    window.location.href = '/dashboard.html';
  } catch (err) {
    console.error('Login Error:', err);
    errEl.textContent = err.message || 'Login failed. Check your credentials.';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

document.getElementById('signupBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('signupBtn');
  const errEl = document.getElementById('errorMsg');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    errEl.textContent = 'Please enter both username and password to create an admin account.';
    return;
  }
  
  btn.disabled = true;
  btn.textContent = 'Signing up…';
  errEl.textContent = '';

  try {
    const res = await fetch('/setup-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Signup failed.');
    }

    errEl.textContent = 'Success! You can now sign in.';
    btn.disabled = false;
    btn.textContent = 'Sign Up';
  } catch (err) {
    console.error('Signup Error:', err);
    errEl.textContent = err.message || 'Signup failed. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Sign Up';
  }
});
