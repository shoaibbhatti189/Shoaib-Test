let supabase = null;

async function initSupabase() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (config.supabaseUrl && config.supabaseKey) {
      supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
      
      // Check session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        localStorage.setItem('token', session.access_token);
        window.location.href = '/dashboard.html';
      }
    }
  } catch (err) {
    console.error('Failed to load config', err);
  }
}

initSupabase();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const errEl = document.getElementById('errorMsg');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    errEl.textContent = 'Please enter both email and password.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errEl.textContent = '';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    localStorage.setItem('token', data.session.access_token);
    window.location.href = '/dashboard.html';
  } catch (err) {
    errEl.textContent = 'Login failed. Check your credentials.';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

document.getElementById('signupBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('signupBtn');
  const errEl = document.getElementById('errorMsg');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    errEl.textContent = 'Please enter both email and password.';
    return;
  }
  
  if (password.length < 6) {
    errEl.textContent = 'Password needs at least 6 characters.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing up…';
  errEl.textContent = '';

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('already registered') || error.status === 422) {
         errEl.textContent = 'An account with this email already exists.';
      } else {
         throw error;
      }
    } else {
      errEl.textContent = 'Success! You can now sign in.';
    }
  } catch (err) {
    errEl.textContent = 'Signup failed. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign Up';
  }
});
