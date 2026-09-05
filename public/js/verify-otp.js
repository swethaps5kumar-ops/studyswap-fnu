const params = new URLSearchParams(window.location.search);
const email = params.get('email') || '';
document.getElementById('emailLabel').textContent = email;

const form = document.getElementById('otpForm');
const alertEl = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');
const resendBtn = document.getElementById('resendBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertEl);
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';

  const otp = document.getElementById('otp').value.trim();

  try {
    await api('/auth/verify-otp', { method: 'POST', body: { email, otp } });
    showAlert(alertEl, 'Email verified! Your account now needs admin approval before you can log in.', 'success');
    form.querySelector('button').textContent = 'Verified';
    setTimeout(() => { window.location.href = 'login.html'; }, 2500);
  } catch (err) {
    showAlert(alertEl, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Verify email';
  }
});

resendBtn.addEventListener('click', async () => {
  hideAlert(alertEl);
  resendBtn.disabled = true;
  try {
    await api('/auth/resend-otp', { method: 'POST', body: { email } });
    showAlert(alertEl, 'A new code has been sent.', 'success');
  } catch (err) {
    showAlert(alertEl, err.message);
  } finally {
    resendBtn.disabled = false;
  }
});
