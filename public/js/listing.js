const listingId = new URLSearchParams(window.location.search).get('id');
let currentUser = null;
let listing = null;
let activeBuyerId = null;
let pollTimer = null;

const badgeMap = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadListing() {
  try {
    const data = await api(`/listings/${listingId}`);
    listing = data.listing;
  } catch (err) {
    document.getElementById('loadError').textContent = err.message;
    document.getElementById('loadError').classList.remove('hidden');
    return;
  }

  document.getElementById('content').classList.remove('hidden');
  document.getElementById('badge').innerHTML = `<span class="badge badge-${listing.status}">${badgeMap[listing.status]}</span>`;
  document.getElementById('title').textContent = listing.title;
  document.getElementById('price').textContent = money(listing.price);
  document.getElementById('description').textContent = listing.description || 'No description provided.';
  document.getElementById('meta').textContent =
    `Seller: ${listing.seller.name} · Listed ${fmtDate(listing.created_at)}` +
    (listing.keywords ? ` · Keywords: ${listing.keywords}` : '');

  renderActions();
  renderChatArea();
}

function renderActions() {
  const el = document.getElementById('actions');
  el.innerHTML = '';
  if (currentUser.role !== 'student') return;

  const isOwner = listing.seller.id === currentUser.id;

  if (isOwner) {
    if (listing.status !== 'sold') {
      el.innerHTML += `<button id="soldBtn" class="btn-sage">Mark as sold</button>`;
    }
    el.innerHTML += `<button id="deleteBtn" class="btn-outline">Delete listing</button>`;
  } else if (listing.status === 'available') {
    el.innerHTML += `<button id="reserveBtn" class="btn-gold">Reserve this item</button>`;
  } else if (listing.status === 'reserved' && listing.reservedByUser && listing.reservedByUser.id === currentUser.id) {
    el.innerHTML += `<p class="muted" style="margin:0;">You reserved this item.</p><button id="cancelBtn" class="btn-outline">Cancel reservation</button>`;
  } else if (listing.status === 'reserved') {
    el.innerHTML += `<p class="muted" style="margin:0;">This item is reserved by another student.</p>`;
  } else if (listing.status === 'sold') {
    el.innerHTML += `<p class="muted" style="margin:0;">This item has been sold.</p>`;
  }

  const alertEl = document.getElementById('actionAlert');
  const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };

  bind('reserveBtn', async () => {
    hideAlert(alertEl);
    try { await api(`/listings/${listingId}/reserve`, { method: 'POST' }); await loadListing(); }
    catch (err) { showAlert(alertEl, err.message); }
  });
  bind('cancelBtn', async () => {
    hideAlert(alertEl);
    try { await api(`/listings/${listingId}/cancel-reservation`, { method: 'POST' }); await loadListing(); }
    catch (err) { showAlert(alertEl, err.message); }
  });
  bind('soldBtn', async () => {
    hideAlert(alertEl);
    try { await api(`/listings/${listingId}/sold`, { method: 'POST' }); await loadListing(); }
    catch (err) { showAlert(alertEl, err.message); }
  });
  bind('deleteBtn', async () => {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    try { await api(`/listings/${listingId}`, { method: 'DELETE' }); window.location.href = 'dashboard.html'; }
    catch (err) { showAlert(alertEl, err.message); }
  });
}

async function renderChatArea() {
  const threadListEl = document.getElementById('threadList');
  const chatHintEl = document.getElementById('chatHint');
  const chatBoxEl = document.getElementById('chatBox');
  const isOwner = currentUser.role === 'student' && listing.seller.id === currentUser.id;

  if (currentUser.role !== 'student') {
    chatHintEl.textContent = 'Log in as a student to chat about this listing.';
    threadListEl.classList.add('hidden');
    chatBoxEl.classList.add('hidden');
    return;
  }

  if (isOwner) {
    const { threads } = await api(`/chat/${listingId}/threads`);
    if (threads.length === 0) {
      chatHintEl.textContent = 'No one has messaged you about this listing yet.';
      threadListEl.classList.add('hidden');
      chatBoxEl.classList.add('hidden');
      return;
    }
    chatHintEl.textContent = '';
    threadListEl.classList.remove('hidden');
    threadListEl.innerHTML = threads.map(t => `
      <button class="thread-item ${t.buyerId === activeBuyerId ? 'active' : ''}" data-buyer="${t.buyerId}">
        <div class="name">${escapeHtml(t.buyerName)}</div>
        <div class="preview">${escapeHtml(t.lastMessage || 'No messages yet')}</div>
      </button>
    `).join('');
    threadListEl.querySelectorAll('.thread-item').forEach(btn => {
      btn.addEventListener('click', () => openThread(Number(btn.dataset.buyer)));
    });
    if (!activeBuyerId) openThread(threads[0].buyerId);
    else openThread(activeBuyerId);
  } else {
    chatHintEl.textContent = '';
    threadListEl.classList.add('hidden');
    chatBoxEl.classList.remove('hidden');
    activeBuyerId = currentUser.id;
    await refreshMessages();
    startPolling();
  }
}

function openThread(buyerId) {
  activeBuyerId = buyerId;
  document.querySelectorAll('.thread-item').forEach(b => b.classList.toggle('active', Number(b.dataset.buyer) === buyerId));
  document.getElementById('chatBox').classList.remove('hidden');
  refreshMessages();
  startPolling();
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshMessages, 4000);
}

async function refreshMessages() {
  const isOwner = listing.seller.id === currentUser.id;
  const qs = isOwner ? `?buyerId=${activeBuyerId}` : '';
  try {
    const { messages } = await api(`/chat/${listingId}${qs}`);
    const box = document.getElementById('chatMessages');
    const wasAtBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
    box.innerHTML = messages.map(m => `
      <div class="chat-bubble ${m.mine ? 'mine' : 'theirs'}">
        <div class="who">${escapeHtml(m.senderName)} · ${fmtDate(m.createdAt)}</div>
        ${escapeHtml(m.message)}
      </div>
    `).join('') || '<p class="muted" style="font-size:0.85rem;">Say hello to start the conversation.</p>';
    if (wasAtBottom) box.scrollTop = box.scrollHeight;
  } catch (err) { /* silent on poll failures */ }
}

document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const isOwner = listing.seller.id === currentUser.id;
  const body = isOwner ? { message: text, buyerId: activeBuyerId } : { message: text };
  try {
    await api(`/chat/${listingId}`, { method: 'POST', body });
    input.value = '';
    await refreshMessages();
    if (isOwner) renderChatArea(); // refresh thread previews
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

(async function init() {
  if (!listingId) { window.location.href = 'dashboard.html'; return; }
  currentUser = await requireSession();
  if (!currentUser) return;
  await loadListing();
})();
