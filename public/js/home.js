// home.js - powers the public homepage: search bar + latest items.
const homeBadge = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };

function homeCardHtml(l) {
  const thumb = l.image
    ? `<img src="${l.image}" alt="${escapeHtml(l.title)}" style="width:100%; height:140px; object-fit:cover; border-radius:8px; margin-bottom:10px;" />`
    : '';
  return `
    <a class="swap-tag" href="listing.html?id=${l.id}">
      ${thumb}
      <span class="badge badge-${l.status}">${homeBadge[l.status] || l.status}</span>
      <h3>${escapeHtml(l.title)}</h3>
      <div class="price">${money(l.price)}</div>
      <p class="meta">Seller: ${escapeHtml(l.seller_first_name)}</p>
    </a>`;
}

async function loadHome(query) {
  const grid = document.getElementById('homeGrid');
  const empty = document.getElementById('homeEmpty');
  try {
    const res = await fetch('/api/public/listings' + (query ? '?q=' + encodeURIComponent(query) : ''));
    const data = await res.json();
    grid.innerHTML = data.listings.map(homeCardHtml).join('');
    empty.classList.toggle('hidden', data.listings.length > 0);
    document.getElementById('itemsHeading').textContent = query ? `Results for "${query}"` : 'Just listed';
  } catch (err) {
    grid.innerHTML = '';
    empty.textContent = 'Items did not load. Check your connection and refresh the page.';
    empty.classList.remove('hidden');
  }
}

document.getElementById('heroSearch').addEventListener('submit', (e) => {
  e.preventDefault();
  loadHome(document.getElementById('heroQuery').value.trim());
  document.getElementById('itemsHeading').scrollIntoView({ behavior: 'smooth' });
});

let homeTimer = null;
document.getElementById('heroQuery').addEventListener('input', (e) => {
  clearTimeout(homeTimer);
  homeTimer = setTimeout(() => loadHome(e.target.value.trim()), 300);
});

document.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('heroQuery').value = btn.dataset.q;
    loadHome(btn.dataset.q);
    document.getElementById('itemsHeading').scrollIntoView({ behavior: 'smooth' });
  });
});

loadHome('');
