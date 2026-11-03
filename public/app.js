'use strict';

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Футболка Essential', category: 'Футболки', description: 'Плотный хлопок и свободная посадка на каждый день.', price: 2490, old_price: null, image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85', badge: 'ХИТ', sizes: ['XS','S','M','L','XL'], stock: 30, is_new: true },
  { id: 2, name: 'Джинсы Straight', category: 'Брюки', description: 'Прямой силуэт и универсальный синий деним.', price: 4990, old_price: 5990, image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=85', badge: '−17%', sizes: ['S','M','L','XL'], stock: 18, is_new: false },
  { id: 3, name: 'Рубашка Soft Form', category: 'Рубашки', description: 'Мягкая ткань, лаконичный крой и спокойный оттенок.', price: 3890, old_price: null, image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85', badge: 'НОВИНКА', sizes: ['S','M','L','XL'], stock: 14, is_new: true },
  { id: 4, name: 'Куртка City', category: 'Верхняя одежда', description: 'Лёгкий верхний слой для прохладных городских дней.', price: 8990, old_price: 10990, image_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85', badge: '−18%', sizes: ['S','M','L','XL'], stock: 9, is_new: false },
  { id: 5, name: 'Свитшот Weekend', category: 'Толстовки', description: 'Комфортный свитшот с минималистичным дизайном.', price: 4290, old_price: null, image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=85', badge: null, sizes: ['XS','S','M','L','XL'], stock: 22, is_new: true },
  { id: 6, name: 'Брюки Daily', category: 'Брюки', description: 'Расслабленная посадка и аккуратная линия силуэта.', price: 4590, old_price: null, image_url: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=85', badge: null, sizes: ['S','M','L','XL'], stock: 12, is_new: false },
  { id: 7, name: 'Топ Layer', category: 'Футболки', description: 'Базовый слой, который легко сочетать с любыми вещами.', price: 1890, old_price: null, image_url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=85', badge: 'БАЗА', sizes: ['XS','S','M','L'], stock: 26, is_new: false },
  { id: 8, name: 'Кардиган Calm', category: 'Толстовки', description: 'Мягкий трикотаж и уютная фактура без лишних деталей.', price: 5490, old_price: null, image_url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=85', badge: 'НОВИНКА', sizes: ['S','M','L'], stock: 11, is_new: true }
];

const state = {
  products: [...FALLBACK_PRODUCTS],
  activeCategory: 'all',
  search: '',
  sort: 'featured',
  cart: readStorage('forma-cart', []),
  favorites: new Set(readStorage('forma-favorites', [])),
  favoritesOnly: false,
  cartOpen: false,
  currentUser: null,
  authMode: 'login',
  toastTimer: null
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value) || 0);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function readStorage(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch (_error) { return fallback; }
}
function saveStorage() {
  try {
    localStorage.setItem('forma-cart', JSON.stringify(state.cart));
    localStorage.setItem('forma-favorites', JSON.stringify([...state.favorites]));
  } catch (_error) { /* Работа сайта не должна зависеть от доступности localStorage. */ }
}
function getProduct(id) { return state.products.find((product) => Number(product.id) === Number(id)); }
function productImage(product) { return escapeHTML(product.image_url || ''); }
function productIsFavorite(id) { return state.favorites.has(Number(id)); }
function productCard(product) {
  const favorite = productIsFavorite(product.id);
  const isSale = Boolean(product.old_price && Number(product.old_price) > Number(product.price));
  const badge = product.badge ? `<span class="product-badge ${isSale ? 'sale' : ''}">${escapeHTML(product.badge)}</span>` : '';
  return `<article class="product-card">
    <div class="product-image-wrap">
      ${badge}
      <button type="button" class="product-heart ${favorite ? 'active' : ''}" data-favorite="${Number(product.id)}" title="${favorite ? 'Убрать из избранного' : 'Добавить в избранное'}" aria-label="${favorite ? 'Убрать из избранного' : 'Добавить в избранное'}" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button>
      <img class="product-image" src="${productImage(product)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/700x900/e9e7df/55584e?text=FORMA'">
      <button class="quick-add" data-add="${Number(product.id)}">Добавить в корзину <span>↗</span></button>
    </div>
    <div class="product-info">
      <div class="product-category">${escapeHTML(product.category)}</div>
      <div class="product-name-row"><span class="product-name">${escapeHTML(product.name)}</span><span class="product-price">${isSale ? `<span class="old-price">${money(product.old_price)}</span>` : ''}${money(product.price)}</span></div>
      <p class="product-description">${escapeHTML(product.description || '')}</p>
      <div class="product-colors" aria-label="Цвета: молочный, графитовый, песочный"><span class="color-dot"></span><span class="color-dot"></span><span class="color-dot"></span></div>
    </div>
  </article>`;
}
function filteredProducts() {
  let products = [...state.products];
  if (state.activeCategory === 'Новинки') products = products.filter((product) => product.is_new);
  else if (state.activeCategory !== 'all') products = products.filter((product) => product.category === state.activeCategory);
  const query = state.search.trim().toLocaleLowerCase('ru-RU');
  if (query) products = products.filter((product) => `${product.name} ${product.category} ${product.description || ''}`.toLocaleLowerCase('ru-RU').includes(query));
  if (state.favoritesOnly) products = products.filter((product) => productIsFavorite(product.id));
  switch (state.sort) {
    case 'price-asc': products.sort((a, b) => Number(a.price) - Number(b.price)); break;
    case 'price-desc': products.sort((a, b) => Number(b.price) - Number(a.price)); break;
    case 'name': products.sort((a, b) => a.name.localeCompare(b.name, 'ru')); break;
    default: products.sort((a, b) => Number(a.id) - Number(b.id));
  }
  return products;
}
function renderProducts() {
  const products = filteredProducts();
  $('#productGrid').innerHTML = products.map(productCard).join('');
  $('#productGrid').classList.toggle('filtered-grid', products.length < 4);
  $('#emptyState').classList.toggle('hidden', products.length !== 0);
  $('#productGrid').classList.toggle('hidden', products.length === 0);
  $('#resultsText').textContent = state.favoritesOnly ? `В избранном: ${products.length}` : `${products.length} ${plural(products.length, ['товар', 'товара', 'товаров'])} для твоего гардероба`;
  $('#resetFilters').classList.toggle('hidden', state.activeCategory === 'all' && !state.search && !state.favoritesOnly && state.sort === 'featured');
  $$('.category-tab').forEach((button) => button.classList.toggle('active', button.dataset.category === state.activeCategory));
  $('#favoritesCount').textContent = state.favorites.size;
  $('#allCount').textContent = String(state.products.length).padStart(2, '0');
}
function plural(number, forms) {
  const abs = Math.abs(number) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  return last === 1 ? forms[0] : forms[2];
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function addToCart(id) {
  const product = getProduct(id);
  if (!product) return;
  const existing = state.cart.find((item) => Number(item.id) === Number(id) && item.size === (product.sizes?.includes('M') ? 'M' : product.sizes?.[0] || 'M'));
  const size = product.sizes?.includes('M') ? 'M' : product.sizes?.[0] || 'M';
  if (existing) existing.quantity = Math.min(20, existing.quantity + 1);
  else state.cart.push({ id: Number(id), quantity: 1, size });
  saveStorage(); renderCart(); showToast(`${product.name} добавлен в корзину`);
}
function cartQuantity() { return state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0); }
function cartTotal() { return state.cart.reduce((sum, item) => sum + Number(getProduct(item.id)?.price || 0) * Number(item.quantity || 0), 0); }
function renderCart() {
  state.cart = state.cart.filter((item) => getProduct(item.id) && Number(item.quantity) > 0).map((item) => ({ ...item, quantity: Math.min(20, Math.max(1, Number(item.quantity) || 1)), size: item.size || 'M' }));
  const totalQuantity = cartQuantity();
  $('#cartCount').textContent = totalQuantity;
  $('#drawerCount').textContent = `(${totalQuantity})`;
  $('#cartEmpty').classList.toggle('hidden', state.cart.length > 0);
  $('#cartSummary').classList.toggle('hidden', state.cart.length === 0);
  $('#cartItems').innerHTML = state.cart.map((item) => {
    const product = getProduct(item.id);
    if (!product) return '';
    return `<article class="cart-line">
      <img class="cart-line-image" src="${productImage(product)}" alt="${escapeHTML(product.name)}" onerror="this.onerror=null;this.src='https://placehold.co/180x220/e9e7df/55584e?text=FORMA'">
      <div class="cart-line-details"><span class="cart-line-category">${escapeHTML(product.category)}</span><span class="cart-line-name">${escapeHTML(product.name)}</span><span class="cart-line-size">Размер: ${escapeHTML(item.size)}</span><div class="quantity-control"><button data-quantity="-1" data-id="${Number(item.id)}" data-size="${escapeHTML(item.size)}" aria-label="Уменьшить количество">−</button><span>${item.quantity}</span><button data-quantity="1" data-id="${Number(item.id)}" data-size="${escapeHTML(item.size)}" aria-label="Увеличить количество">+</button></div></div>
      <div class="cart-line-end"><span class="cart-line-price">${money(Number(product.price) * item.quantity)}</span><button class="remove-line" data-remove="${Number(item.id)}" data-size="${escapeHTML(item.size)}" aria-label="Удалить товар">×</button></div>
    </article>`;
  }).join('');
  const total = cartTotal();
  $('#cartSubtotal').textContent = money(total);
  $('#cartTotal').textContent = money(total);
  $('#checkoutTotal').textContent = money(total);
  $('#deliveryMessage').textContent = total >= 7000 ? 'Отлично! Для твоего заказа доступна бесплатная доставка.' : `До бесплатной доставки осталось ${money(7000 - total)}.`;
  $('#shippingCost').textContent = total >= 7000 ? 'Бесплатно' : 'Уточняется';
  saveStorage();
}
function openCart() {
  state.cartOpen = true;
  $('#overlay').classList.add('open'); $('#cartDrawer').classList.add('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll');
  $('#closeCartButton').focus();
}
function closeCart() {
  state.cartOpen = false;
  $('#overlay').classList.remove('open'); $('#cartDrawer').classList.remove('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'true');
  if (!$('#checkoutBackdrop').classList.contains('open')) document.body.classList.remove('no-scroll');
}
function openCheckout() {
  if (!state.cart.length) return;
  $('#checkoutError').textContent = '';
  $('#checkoutBackdrop').classList.add('open'); $('#checkoutBackdrop').setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll'); closeCart(); $('#checkoutBackdrop').classList.add('open'); $('#checkoutBackdrop').setAttribute('aria-hidden', 'false');
  $('#checkoutTotal').textContent = money(cartTotal()); $('#checkoutForm [name="name"]').focus();
}
function closeCheckout() {
  $('#checkoutBackdrop').classList.remove('open'); $('#checkoutBackdrop').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}
function resetFilters() {
  state.activeCategory = 'all'; state.search = ''; state.sort = 'featured'; state.favoritesOnly = false;
  $('#searchInput').value = ''; $('#sortSelect').value = 'featured'; renderProducts();
}
function toggleFavorite(id) {
  const product = getProduct(id);
  if (state.favorites.has(Number(id))) { state.favorites.delete(Number(id)); showToast('Удалено из избранного'); }
  else { state.favorites.add(Number(id)); showToast('Добавлено в избранное'); }
  saveStorage(); renderProducts();
  if (state.favoritesOnly && product && !productIsFavorite(product.id)) renderProducts();
}

$('#productGrid').addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  const favoriteButton = event.target.closest('[data-favorite]');
  if (addButton) addToCart(Number(addButton.dataset.add));
  if (favoriteButton) toggleFavorite(Number(favoriteButton.dataset.favorite));
});
$('#categoryTabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.activeCategory = button.dataset.category; state.favoritesOnly = false; renderProducts();
});
$('#searchInput').addEventListener('input', (event) => { state.search = event.target.value; state.favoritesOnly = false; renderProducts(); });
$('#sortSelect').addEventListener('change', (event) => { state.sort = event.target.value; renderProducts(); });
$('#resetFilters').addEventListener('click', resetFilters);
$('#emptyReset').addEventListener('click', resetFilters);
$('#showAllLink').addEventListener('click', (event) => { event.preventDefault(); resetFilters(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); });
$('#openCartButton').addEventListener('click', openCart);
$('#closeCartButton').addEventListener('click', closeCart);
$('#overlay').addEventListener('click', closeCart);
$('#continueShopping').addEventListener('click', () => { closeCart(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); });
$('#checkoutButton').addEventListener('click', openCheckout);
$('#closeCheckoutButton').addEventListener('click', closeCheckout);
$('#checkoutBackdrop').addEventListener('click', (event) => { if (event.target === $('#checkoutBackdrop')) closeCheckout(); });
$('#cartItems').addEventListener('click', (event) => {
  const quantityButton = event.target.closest('[data-quantity]');
  const removeButton = event.target.closest('[data-remove]');
  if (quantityButton) {
    const item = state.cart.find((entry) => Number(entry.id) === Number(quantityButton.dataset.id) && entry.size === quantityButton.dataset.size);
    if (!item) return;
    item.quantity += Number(quantityButton.dataset.quantity);
    if (item.quantity <= 0) state.cart = state.cart.filter((entry) => entry !== item);
    if (item.quantity > 20) item.quantity = 20;
    renderCart();
  }
  if (removeButton) {
    state.cart = state.cart.filter((entry) => !(Number(entry.id) === Number(removeButton.dataset.remove) && entry.size === removeButton.dataset.size));
    renderCart(); showToast('Товар удалён из корзины');
  }
});
$('#favoritesButton').addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  if (state.favoritesOnly) { state.activeCategory = 'all'; state.search = ''; $('#searchInput').value = ''; }
  renderProducts(); $('#catalog').scrollIntoView({ behavior: 'smooth' });
  if (state.favoritesOnly && state.favorites.size === 0) showToast('Пока нет избранных товаров');
});
$$('[data-nav-category]').forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault(); const category = link.dataset.navCategory;
  state.activeCategory = category === 'all' ? 'all' : category; state.search = ''; state.favoritesOnly = false;
  $('#searchInput').value = ''; renderProducts(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); $('#mainNav').classList.remove('open');
}));
function setAuthMode(mode) {
  state.authMode = mode;
  $('#loginForm').classList.toggle('hidden', mode !== 'login');
  $('#registerForm').classList.toggle('hidden', mode !== 'register');
  $$('[data-auth-mode]').forEach((button) => button.classList.toggle('active', button.dataset.authMode === mode));
  $('#loginError').textContent = '';
  $('#registerError').textContent = '';
}
function renderAccount() {
  const signedIn = Boolean(state.currentUser);
  $('#accountButton').textContent = signedIn ? state.currentUser.login : 'Войти';
  $('#authForms').classList.toggle('hidden', signedIn);
  $('#accountPanel').classList.toggle('hidden', !signedIn);
  if (signedIn) $('#accountLogin').textContent = state.currentUser.login;
}

async function loadMyOrders() {
  const message = $('#ordersMessage');
  const list = $('#ordersList');
  if (!state.currentUser) return;
  message.textContent = 'Загружаем заказы…';
  list.innerHTML = '';
  try {
    const response = await fetch('/api/my-orders', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const result = await response.json().catch(() => []);
    if (!response.ok) throw new Error(result.error || 'Не удалось загрузить заказы.');
    if (!result.length) {
      message.textContent = 'У тебя пока нет оформленных заказов.';
      return;
    }
    message.textContent = '';
    list.innerHTML = result.map((order) => {
      const date = new Date(order.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      const items = (order.items || []).map((item) =>
        '<div class="order-item"><span>' + escapeHTML(item.productName) + ' · ' + escapeHTML(item.size) + ' · ' + Number(item.quantity) + ' шт.</span><strong>' + money(Number(item.unitPrice) * Number(item.quantity)) + '</strong></div>'
      ).join('');
      return '<article class="order-card"><div class="order-card-top"><div><strong>Заказ №' + escapeHTML(order.id) + '</strong><small>' + escapeHTML(date) + '</small></div><span class="order-status">' + escapeHTML(order.status) + '</span></div><div class="order-items">' + items + '</div><div class="order-card-total"><span>Итого</span><strong>' + money(order.total) + '</strong></div></article>';
    }).join('');
  } catch (error) {
    message.textContent = error.message;
  }
}

function openAccount() {
  $('#accountBackdrop').classList.add('open');
  $('#accountBackdrop').setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  $('#logoutError').textContent = '';
  renderAccount();
  if (state.currentUser) loadMyOrders();
  if (!state.currentUser) {
    setAuthMode(state.authMode);
    const firstInput = state.authMode === 'login' ? $('#loginForm [name="login"]') : $('#registerForm [name="login"]');
    firstInput.focus();
  } else {
    $('#closeAccountButton').focus();
  }
}
function closeAccount() {
  $('#accountBackdrop').classList.remove('open');
  $('#accountBackdrop').setAttribute('aria-hidden', 'true');
  if (!$('#checkoutBackdrop').classList.contains('open')) document.body.classList.remove('no-scroll');
}
async function requestAuth(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Не удалось выполнить запрос.');
  return result;
}
async function checkCurrentUser() {
  try {
    const response = await fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const result = await response.json();
    state.currentUser = result.authenticated ? result.user : null;
    renderAccount();
  } catch (_error) {
    // Если сервер недоступен, магазин продолжает работать в режиме просмотра.
  }
}
$('#accountButton').addEventListener('click', openAccount);
$('#closeAccountButton').addEventListener('click', closeAccount);
$('#accountBackdrop').addEventListener('click', (event) => {
  if (event.target === $('#accountBackdrop')) closeAccount();
});
$$('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = $('#loginError');
  const submit = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  submit.disabled = true;
  errorBox.textContent = '';
  try {
    const result = await requestAuth('/api/login', { login: data.get('login'), password: data.get('password') });
    state.currentUser = result.user;
    form.reset();
    renderAccount();
    loadMyOrders();
    showToast('С возвращением, ' + result.user.login + '!');
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('#registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = $('#registerError');
  const submit = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const login = String(data.get('login') || '').trim();
  const password = String(data.get('password') || '');
  const confirmPassword = String(data.get('confirmPassword') || '');
  errorBox.textContent = '';
  if (password !== confirmPassword) {
    errorBox.textContent = 'Пароли не совпадают.';
    return;
  }
  if (!/^[A-Za-z0-9_]{3,30}$/.test(login)) {
    errorBox.textContent = 'Логин: от 3 до 30 символов — латинские буквы, цифры или _.';
    return;
  }
  if (new TextEncoder().encode(password).length > 72) {
    errorBox.textContent = 'Пароль слишком длинный. Максимум — 72 байта.';
    return;
  }
  submit.disabled = true;
  try {
    const result = await requestAuth('/api/register', { login, password });
    state.currentUser = result.user;
    form.reset();
    renderAccount();
    loadMyOrders();
    showToast('Аккаунт создан. Добро пожаловать!');
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
$('#refreshOrdersButton').addEventListener('click', loadMyOrders);
$('#logoutButton').addEventListener('click', async () => {
  const errorBox = $('#logoutError');
  errorBox.textContent = '';
  try {
    const response = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось выйти из аккаунта.');
    state.currentUser = null;
    renderAccount();
    setAuthMode('login');
    showToast('Ты вышел из аккаунта.');
  } catch (error) {
    errorBox.textContent = error.message;
  }
});

$('#mobileMenuButton').addEventListener('click', () => $('#mainNav').classList.toggle('open'));
$('#searchInput').addEventListener('focus', () => { if (window.matchMedia('(max-width: 760px)').matches) $('.search-box').classList.add('expanded'); });
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-box') && window.matchMedia('(max-width: 760px)').matches) $('.search-box').classList.remove('expanded');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeCart(); closeCheckout(); closeAccount(); $('#mainNav').classList.remove('open'); }
});
$('#newsletterForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const email = $('#newsletterEmail').value.trim();
  if (!email) return;
  $('#newsletterMessage').textContent = 'Спасибо! В демонстрационной версии подписка не отправляется на сервер.';
  $('#newsletterMessage').style.color = '#263416';
  $('#newsletterEmail').value = '';
  showToast('Спасибо за интерес к FORMA!');
});
$('#checkoutForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.cart.length) { closeCheckout(); return; }
  const submitButton = $('#submitOrderButton');
  const errorBox = $('#checkoutError');
  const data = new FormData(event.currentTarget);
  const customer = Object.fromEntries(data.entries());
  const payload = { customer, items: state.cart.map((item) => ({ id: Number(item.id), quantity: Number(item.quantity), size: item.size })) };
  submitButton.disabled = true; submitButton.innerHTML = 'Отправляем заказ…'; errorBox.textContent = '';
  try {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось оформить заказ. Проверьте подключение базы данных.');
    state.cart = []; saveStorage(); renderCart(); closeCheckout(); event.currentTarget.reset();
    if (state.currentUser) loadMyOrders();
    showToast(`Заказ №${result.orderId} оформлен! Мы свяжемся с вами.`);
  } catch (error) {
    errorBox.textContent = error.message.includes('Failed to fetch') ? 'Не удалось связаться с сервером. Запустите проект через npm start, настройте PostgreSQL и повторите попытку.' : error.message;
  } finally {
    submitButton.disabled = false; submitButton.innerHTML = 'Подтвердить заказ <span>↗</span>';
  }
});

async function loadProducts() {
  // При открытии index.html напрямую каталог всё равно отображается на демонстрационных данных.
  // При запуске сервера список загружается из PostgreSQL.
  try {
    const response = await fetch('/api/products', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const products = await response.json();
    if (Array.isArray(products) && products.length) {
      state.products = products.map((product) => ({ ...product, id: Number(product.id), price: Number(product.price), old_price: product.old_price == null ? null : Number(product.old_price), sizes: Array.isArray(product.sizes) ? product.sizes : ['S','M','L'], is_new: Boolean(product.is_new) }));
      renderProducts(); renderCart();
    }
  } catch (_error) { /* Локальный режим просмотра без сервера. */ }
}

renderProducts(); renderCart();
loadProducts();
checkCurrentUser();
