const form = document.getElementById('registerForm');
const alertEl = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertEl);
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    await api('/auth/register', { method: 'POST', body: { firstName, lastName, email, password } });
    window.location.href = `verify-otp.html?email=${encodeURIComponent(email)}`;
  } catch (err) {
    showAlert(alertEl, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send verification code';
  }
});
