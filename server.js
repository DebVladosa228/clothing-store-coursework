require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);


if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET === 'replace_with_a_long_random_secret'
) {
  throw new Error('Укажите уникальный SESSION_SECRET в переменных окружения.');
}

const app = express();
const port = Number(process.env.PORT || 3000);
// In hosting, DATABASE_URL contains the remote PostgreSQL connection string.
// Locally, the project can continue to use PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'forma_store',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      connectionTimeoutMillis: 2500
    };
const pool = new Pool(poolConfig);
const sessionStore = new PgSession({
  pool,
  tableName: 'user_sessions',
  createTableIfMissing: true
});

// Связываем новые заказы с аккаунтами. Старые и гостевые заказы остаются без владельца.
const accountOrdersSchemaReady = pool.query(`
  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
    ON orders(user_id, created_at DESC);
`).catch((error) => {
  console.error('Не удалось подготовить историю заказов:', error.message);
  throw error;
});

app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(session({
  store: sessionStore,
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

function startUserSession(req, res, user, statusCode = 200, message = 'Вход выполнен успешно.') {
  req.session.regenerate((error) => {
    if (error) {
      console.error('Не удалось создать сессию:', error);
      return res.status(500).json({ error: 'Не удалось выполнить вход.' });
    }

    req.session.userId = user.id;
    req.session.save((saveError) => {
      if (saveError) {
        console.error('Не удалось сохранить сессию:', saveError);
        return res.status(500).json({ error: 'Не удалось сохранить сессию.' });
      }

      return res.status(statusCode).json({
        message,
        user: { id: user.id, login: user.login }
      });
    });
  });
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (_error) {
    res.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, category, description, price, old_price, image_url, badge, sizes, stock, is_new
       FROM products
       WHERE ($1::text IS NULL OR category = $1)
         AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
       ORDER BY id`,
      [req.query.category || null, req.query.search || null]
    );
    res.json(rows);
  } catch (error) {
    console.error('Не удалось получить каталог:', error.message);
    res.status(503).json({ error: 'Не удалось загрузить каталог. Проверьте подключение PostgreSQL.' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { login, password } = req.body;

    // Проверяем, что логин и пароль переданы
    if (
      typeof login !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        error: 'Введите логин и пароль.'
      });
    }

    const cleanLogin = login.trim();

    // Проверяем логин
    if (!/^[A-Za-z0-9_]{3,30}$/.test(cleanLogin)) {
      return res.status(400).json({
        error: 'Логин должен содержать от 3 до 30 символов: латинские буквы, цифры или _.'
      });
    }

    // Проверяем пароль
    if (
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        error: 'Пароль должен содержать не менее 8 символов и не более 72 байт.'
      });
    }

    // Создаём хеш пароля
    const passwordHash = await bcrypt.hash(password, 12);

    // Сохраняем пользователя в базе данных
    const result = await pool.query(
      `INSERT INTO users (login, password_hash)
       VALUES ($1, $2)
       RETURNING id, login, created_at`,
      [cleanLogin, passwordHash]
    );

    return startUserSession(
      req,
      res,
      result.rows[0],
      201,
      'Аккаунт успешно создан.'
    );

  } catch (error) {
    // Проверяем, не занят ли логин
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Этот логин уже занят.'
      });
    }

    console.error('Ошибка регистрации:', error);

    res.status(500).json({
      error: 'Не удалось создать аккаунт.'
    });
  }
});
// Вход в аккаунт
app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (
      typeof login !== 'string' ||
      typeof password !== 'string' ||
      !login.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: 'Введите логин и пароль.'
      });
    }

    // Ищем пользователя в базе
    const result = await pool.query(
      `SELECT id, login, password_hash
       FROM users
       WHERE LOWER(login) = LOWER($1)`,
      [login.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Неверный логин или пароль.'
      });
    }

    const user = result.rows[0];

    // Проверяем пароль
    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Неверный логин или пароль.'
      });
    }

    // Создаём новую сессию после успешной проверки пароля
    return startUserSession(req, res, user);

  } catch (error) {
    console.error('Ошибка входа:', error);

    res.status(500).json({
      error: 'Ошибка сервера при входе.'
    });
  }
});

// Выход из аккаунта
app.post('/api/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        error: 'Не удалось выйти из аккаунта.'
      });
    }

    res.clearCookie('connect.sid');

    res.json({
      message: 'Вы вышли из аккаунта.'
    });
  });
});

// Проверка авторизации
app.get('/api/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({
        authenticated: false
      });
    }

    const result = await pool.query(
      `SELECT id, login, created_at
       FROM users
       WHERE id = $1`,
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        authenticated: false
      });
    }

    res.json({
      authenticated: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Ошибка проверки пользователя:', error);

    res.status(500).json({
      error: 'Не удалось проверить авторизацию.'
    });
  }
});


// Создание заказа. Если покупатель вошёл в аккаунт, заказ сохраняется в его истории.
app.post('/api/orders', async (req, res) => {
  const customer = req.body?.customer || {};
  const items = req.body?.items;
  if (
    typeof customer.name !== 'string' || customer.name.trim().length < 2 ||
    typeof customer.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    typeof customer.phone !== 'string' || customer.phone.trim().length < 5 ||
    typeof customer.address !== 'string' || customer.address.trim().length < 5 ||
    !Array.isArray(items) || items.length === 0 || items.length > 50
  ) {
    return res.status(400).json({ error: 'Проверьте контактные данные и состав заказа.' });
  }

  let client;
  try {
    await accountOrdersSchemaReady;
    client = await pool.connect();
    await client.query('BEGIN');

    const normalizedItems = [];
    let total = 0;
    for (const item of items) {
      const productId = Number(item.id);
      const quantity = Number(item.quantity);
      const size = typeof item.size === 'string' ? item.size.trim() : '';
      if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !size) {
        throw Object.assign(new Error('Некорректный товар в заказе.'), { statusCode: 400 });
      }

      const productResult = await client.query(
        'SELECT id, name, price, sizes, stock FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );
      const product = productResult.rows[0];
      if (!product) throw Object.assign(new Error('Один из товаров больше не существует.'), { statusCode: 400 });
      if (!product.sizes.includes(size)) throw Object.assign(new Error('Выбранный размер недоступен.'), { statusCode: 400 });
      if (Number(product.stock) < quantity) throw Object.assign(new Error(`Недостаточно товара «${product.name}» на складе.`), { statusCode: 409 });

      const unitPrice = Number(product.price);
      total += unitPrice * quantity;
      normalizedItems.push({ ...product, quantity, size, unitPrice });
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, delivery_address, comment, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [req.session?.userId || null, customer.name.trim(), customer.email.trim(), customer.phone.trim(), customer.address.trim(), String(customer.comment || '').trim() || null, total]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.id, item.name, item.size, item.quantity, item.unitPrice]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
    }

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Заказ оформлен.', orderId });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Ошибка оформления заказа:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Не удалось оформить заказ.' });
  } finally {
    if (client) client.release();
  }
});

// История заказов доступна только владельцу аккаунта.
app.get('/api/my-orders', async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Войдите в аккаунт, чтобы посмотреть заказы.' });
  try {
    await accountOrdersSchemaReady;
    const result = await pool.query(
      `SELECT o.id, o.total, o.status, o.created_at,
              COALESCE(
                json_agg(json_build_object(
                  'productName', oi.product_name,
                  'size', oi.size,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price
                ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 50`,
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка загрузки истории заказов:', error);
    res.status(500).json({ error: 'Не удалось загрузить историю заказов.' });
  }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, '0.0.0.0', () => {
  console.log(`FORMA запущен: http://localhost:${port}`);
  pool.query('SELECT 1').then(() => console.log('PostgreSQL: подключение установлено'))
    .catch(() => console.warn('PostgreSQL пока недоступен. Проверьте настройки .env и запустите SQL из db/schema.sql.'));
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
