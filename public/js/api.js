// api.js - tiny fetch wrapper shared by every page.
async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showAlert(el, message, type = 'error') {
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.classList.remove('hidden');
}

function hideAlert(el) {
  el.classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

// Redirects away from student/admin pages if not logged in appropriately.
async function requireSession({ role } = {}) {
  try {
    const { user } = await api('/auth/me');
    if (role && user.role !== role) {
      window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
      return null;
    }
    return user;
  } catch (e) {
    window.location.href = 'login.html';
    return null;
  }
}
