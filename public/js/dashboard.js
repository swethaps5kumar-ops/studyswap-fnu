let currentUser = null;

function badgeHtml(status) {
  const map = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };
  return `<span class="badge badge-${status}">${map[status] || status}</span>`;
}

function listingCardHtml(listing) {
  const thumb = listing.image
    ? `<img src="${listing.image}" alt="${escapeHtml(listing.title)}" style="width:100%; height:140px; object-fit:cover; border-radius:8px; margin-bottom:10px;" />`
    : '';
  return `
    <a class="swap-tag" href="listing.html?id=${listing.id}">
      ${thumb}
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
// Live search: results update shortly after the student stops typing.
let searchTimer = null;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadBrowse(e.target.value.trim()), 300);
});

const newListingPanel = document.getElementById('newListingPanel');
document.getElementById('newListingBtn').addEventListener('click', () => newListingPanel.classList.remove('hidden'));
document.getElementById('cancelListingBtn').addEventListener('click', () => newListingPanel.classList.add('hidden'));

// Show a quick preview of the chosen photo before submitting.
const imageInput = document.getElementById('image');
const imagePreview = document.getElementById('imagePreview');
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) {
    imagePreview.classList.add('hidden');
    imagePreview.src = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.src = reader.result;
    imagePreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

// Shrinks the chosen photo (max 900px wide/tall, JPEG) and returns it as a base64 string.
// Phone photos are often 3-8MB; shrinking keeps the site fast and the database small.
function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image.'));
      img.onload = () => {
        const MAX = 900;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('newListingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertEl = document.getElementById('listingAlert');
  hideAlert(alertEl);

  const title = document.getElementById('title').value.trim();
  const price = document.getElementById('price').value;
  const keywords = document.getElementById('keywords').value.trim();
  const description = document.getElementById('description').value.trim();
  const file = imageInput.files[0];

  if (file && file.size > 10 * 1024 * 1024) {
    showAlert(alertEl, 'That photo is a bit large — please choose one under 10MB.');
    return;
  }

  try {
    const image = await readImageAsDataUrl(file);
    await api('/listings', { method: 'POST', body: { title, price, keywords, description, image } });
    newListingPanel.classList.add('hidden');
    document.getElementById('newListingForm').reset();
    imagePreview.classList.add('hidden');
    imagePreview.src = '';
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
  const startQuery = new URLSearchParams(window.location.search).get('q') || '';
  document.getElementById('searchInput').value = startQuery;
  loadBrowse(startQuery);
})();
