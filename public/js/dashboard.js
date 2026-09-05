let currentUser = null;

function badgeHtml(status) {
  const map = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };
  return `<span class="badge badge-${status}">${map[status] || status}</span>`;
}

function listingCardHtml(listing) {
  return `
    <a class="swap-tag" href="listing.html?id=${listing.id}">
      ${badgeHtml(listing.status)}
      <h3>${escapeHtml(listing.title)}</h3>
      <div class="price">${money(listing.price)}</div>
      <p class="desc">${escapeHtml(listing.description || 'No description provided.')}</p>
      <p class="meta">Seller: ${escapeHtml(listing.seller ? listing.seller.name : 'Unknown')}</p>
    </a>
  `;
}

async function loadBrowse(query = '') {
  const grid = document.getElementById('browseGrid');
  const empty = document.getElementById('browseEmpty');
  const { listings } = await api(`/listings${query ? '?q=' + encodeURIComponent(query) : ''}`);
  grid.innerHTML = listings.map(listingCardHtml).join('');
  empty.classList.toggle('hidden', listings.length > 0);
}

async function loadMine() {
  const grid = document.getElementById('mineGrid');
  const empty = document.getElementById('mineEmpty');
  const { listings } = await api('/listings/mine');
  grid.innerHTML = listings.map(listingCardHtml).join('');
  empty.classList.toggle('hidden', listings.length > 0);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('browseTab').classList.toggle('hidden', tab !== 'browse');
  document.getElementById('mineTab').classList.toggle('hidden', tab !== 'mine');
  document.getElementById('pageHeading').textContent = tab === 'browse' ? 'Browse listings' : 'My listings';
  if (tab === 'browse') loadBrowse(document.getElementById('searchInput').value.trim());
  else loadMine();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('searchBtn').addEventListener('click', () => loadBrowse(document.getElementById('searchInput').value.trim()));
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadBrowse(e.target.value.trim());
});

const newListingPanel = document.getElementById('newListingPanel');
document.getElementById('newListingBtn').addEventListener('click', () => newListingPanel.classList.remove('hidden'));
document.getElementById('cancelListingBtn').addEventListener('click', () => newListingPanel.classList.add('hidden'));

document.getElementById('newListingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertEl = document.getElementById('listingAlert');
  hideAlert(alertEl);
  const title = document.getElementById('title').value.trim();
  const price = document.getElementById('price').value;
  const keywords = document.getElementById('keywords').value.trim();
  const description = document.getElementById('description').value.trim();

  try {
    await api('/listings', { method: 'POST', body: { title, price, keywords, description } });
    newListingPanel.classList.add('hidden');
    document.getElementById('newListingForm').reset();
    switchTab('mine');
  } catch (err) {
    showAlert(alertEl, err.message);
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

(async function init() {
  currentUser = await requireSession({ role: 'student' });
  if (!currentUser) return;
  document.getElementById('userChip').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
  loadBrowse();
})();
