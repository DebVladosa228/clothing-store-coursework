-- База данных интернет-магазина одежды FORMA
-- Выполните этот файл в базе данных forma_store через pgAdmin или psql.

-- Учётные записи покупателей. Храним только bcrypt-хеш пароля.
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    login VARCHAR(30) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_login_length CHECK (char_length(login) BETWEEN 3 AND 30)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique_idx
    ON users (LOWER(login));


CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(60) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    old_price NUMERIC(10, 2),
    image_url TEXT NOT NULL,
    badge VARCHAR(40),
    sizes TEXT[] NOT NULL DEFAULT ARRAY['S', 'M', 'L'],
    stock INTEGER NOT NULL DEFAULT 20 CHECK (stock >= 0),
    is_new BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(180) NOT NULL,
    customer_phone VARCHAR(40) NOT NULL,
    delivery_address TEXT NOT NULL,
    comment TEXT,
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Новый',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name VARCHAR(160) NOT NULL,
    size VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

INSERT INTO products (id, name, category, description, price, old_price, image_url, badge, sizes, stock, is_new)
VALUES
(1, 'Футболка Essential', 'Футболки', 'Плотный хлопок и свободная посадка на каждый день.', 2490, NULL, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85', 'ХИТ', ARRAY['XS','S','M','L','XL'], 30, true),
(2, 'Джинсы Straight', 'Брюки', 'Прямой силуэт и универсальный синий деним.', 4990, 5990, 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=85', '−17%', ARRAY['S','M','L','XL'], 18, false),
(3, 'Рубашка Soft Form', 'Рубашки', 'Мягкая ткань, лаконичный крой и спокойный оттенок.', 3890, NULL, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85', 'НОВИНКА', ARRAY['S','M','L','XL'], 14, true),
(4, 'Куртка City', 'Верхняя одежда', 'Лёгкий верхний слой для прохладных городских дней.', 8990, 10990, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85', '−18%', ARRAY['S','M','L','XL'], 9, false),
(5, 'Свитшот Weekend', 'Толстовки', 'Комфортный свитшот с минималистичным дизайном.', 4290, NULL, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=85', NULL, ARRAY['XS','S','M','L','XL'], 22, true),
(6, 'Брюки Daily', 'Брюки', 'Расслабленная посадка и аккуратная линия силуэта.', 4590, NULL, 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=85', NULL, ARRAY['S','M','L','XL'], 12, false),
(7, 'Топ Layer', 'Футболки', 'Базовый слой, который легко сочетать с любыми вещами.', 1890, NULL, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=85', 'БАЗА', ARRAY['XS','S','M','L'], 26, false),
(8, 'Кардиган Calm', 'Толстовки', 'Мягкий трикотаж и уютная фактура без лишних деталей.', 5490, NULL, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=85', 'НОВИНКА', ARRAY['S','M','L'], 11, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    old_price = EXCLUDED.old_price,
    image_url = EXCLUDED.image_url,
    badge = EXCLUDED.badge,
    sizes = EXCLUDED.sizes,
    stock = EXCLUDED.stock,
    is_new = EXCLUDED.is_new;

SELECT setval(pg_get_serial_sequence('products', 'id'), GREATEST((SELECT MAX(id) FROM products), 1));


-- Связь заказов с аккаунтами (гостевые и старые заказы могут иметь NULL).
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
    ON orders(user_id, created_at DESC);
