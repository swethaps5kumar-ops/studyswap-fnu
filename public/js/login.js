const form = document.getElementById('loginForm');
const alertEl = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertEl);
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const { user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
  } catch (err) {
    showAlert(alertEl, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
});
