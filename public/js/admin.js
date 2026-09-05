const alertEl = document.getElementById('alert');

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('pendingTab').classList.toggle('hidden', tab !== 'pending');
  document.getElementById('allTab').classList.toggle('hidden', tab !== 'all');
  document.getElementById('addTab').classList.toggle('hidden', tab !== 'add');
  hideAlert(alertEl);
  if (tab === 'pending') loadPending();
  if (tab === 'all') loadAll();
}
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadPending() {
  const { users } = await api('/admin/pending');
  const body = document.getElementById('pendingBody');
  document.getElementById('pendingEmpty').classList.toggle('hidden', users.length > 0);
  body.innerHTML = users.map(u => `
    <tr>
      <td>${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td><button class="btn-sage btn-sm" data-approve="${u.id}">Approve</button></td>
    </tr>
  `).join('');
  body.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/admin/approve/${btn.dataset.approve}`, { method: 'POST' });
        showAlert(alertEl, 'Approved.', 'success');
        loadPending();
      } catch (err) { showAlert(alertEl, err.message); }
    });
  });
}

async function loadAll() {
  const { users } = await api('/admin/users');
  const body = document.getElementById('allBody');
  body.innerHTML = users.map(u => {
    const status = u.role === 'admin' ? 'admin' : (!u.is_verified ? 'unverified' : (!u.is_approved ? 'pending' : 'approved'));
    const statusLabel = { admin: 'Admin', unverified: 'Email not verified', pending: 'Pending approval', approved: 'Approved' }[status];
    return `
      <tr>
        <td>${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.role}</td>
        <td>${statusLabel}</td>
        <td class="row-actions">
          ${status === 'pending' ? `<button class="btn-sage btn-sm" data-approve="${u.id}">Approve</button>` : ''}
          ${status === 'approved' ? `<button class="btn-outline btn-sm" data-revoke="${u.id}">Revoke</button>` : ''}
          ${u.role !== 'admin' ? `<button class="btn-coral btn-sm" data-remove="${u.id}">Remove</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  body.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/admin/approve/${btn.dataset.approve}`, { method: 'POST' }); loadAll();
  }));
  body.querySelectorAll('[data-revoke]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/admin/revoke/${btn.dataset.revoke}`, { method: 'POST' }); loadAll();
  }));
  body.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Remove this user? This also deletes their listings and messages.')) return;
    try { await api(`/admin/users/${btn.dataset.remove}`, { method: 'DELETE' }); loadAll(); }
    catch (err) { showAlert(alertEl, err.message); }
  }));
}

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert(alertEl);
  const body = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
    role: document.getElementById('role').value,
  };
  try {
    await api('/admin/users', { method: 'POST', body });
    showAlert(alertEl, 'User added.', 'success');
    e.target.reset();
    switchTab('all');
  } catch (err) { showAlert(alertEl, err.message); }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

(async function init() {
  const user = await requireSession({ role: 'admin' });
  if (!user) return;
  document.getElementById('userChip').textContent = `${user.firstName} ${user.lastName}`;
  loadPending();
})();
