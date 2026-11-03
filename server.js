require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);


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
