require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        device_token TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_data (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data JSONB DEFAULT NULL,
        image_url TEXT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS card_logs (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        image_url TEXT,
        extra_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Database ready!');
  } catch (err) {
    console.error('Database init error:', err.message);
  }
}

app.use(express.static(path.join(__dirname, 'public')));

async function findUserByToken(token) {
  const result = await pool.query('SELECT * FROM users', []);
  return result.rows.find(u => {
    if (!u.device_token) return false;
    try {
      const tokens = JSON.parse(u.device_token);
      if (Array.isArray(tokens)) return tokens.includes(token);
      return u.device_token === token;
    } catch(e) { return u.device_token === token; }
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies.device_token;
  if (!token) return res.redirect('/');
  findUserByToken(token)
    .then(user => {
      if (!user) return res.redirect('/');
      req.user = user;
      next();
    })
    .catch(() => res.redirect('/'));
}

function requireAuthApi(req, res, next) {
  const token = req.cookies.device_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  findUserByToken(token)
    .then(user => {
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      next();
    })
    .catch(() => res.status(401).json({ error: 'Unauthorized' }));
}

function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (token !== 'admin_authenticated') return res.redirect('/admin-login.html');
  next();
}

const SITE_PATH = path.join(__dirname, 'site');
app.use('/site', requireAuth, express.static(SITE_PATH));
app.get('/site', requireAuth, (req, res) => {
  res.sendFile(path.join(SITE_PATH, 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'protected', 'admin.html'));
});

// ============================================================
// API: Zapis i odczyt danych użytkownika
// ============================================================

app.get('/api/userdata', requireAuthApi, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT data, image_url FROM user_data WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.json({ data: null, image_url: null });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/userdata', requireAuthApi, async (req, res) => {
  const { data, image_url } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM user_data WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO user_data (user_id, data, image_url, updated_at) VALUES ($1, $2, $3, NOW())',
        [req.user.id, data ? JSON.stringify(data) : null, image_url || null]
      );
    } else {
      await pool.query(
        'UPDATE user_data SET data = $1, image_url = $2, updated_at = NOW() WHERE user_id = $3',
        [data ? JSON.stringify(data) : null, image_url || null, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/userdata/image', requireAuthApi, async (req, res) => {
  const { image_url } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM user_data WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO user_data (user_id, image_url, updated_at) VALUES ($1, $2, NOW())',
        [req.user.id, image_url || null]
      );
    } else {
      await pool.query(
        'UPDATE user_data SET image_url = $1, updated_at = NOW() WHERE user_id = $2',
        [image_url || null, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// API: Card logs
// ============================================================

app.post('/api/log/card', requireAuthApi, async (req, res) => {
  const { first_name, last_name, image_url, extra_data } = req.body;
  try {
    await pool.query(
      'INSERT INTO card_logs (username, first_name, last_name, image_url, extra_data) VALUES ($1, $2, $3, $4, $5)',
      [req.user.username, first_name || '', last_name || '', image_url || '', JSON.stringify(extra_data || {})]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/card-logs', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM card_logs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// Auth routes
// ============================================================

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid username or password' });
    const newToken = uuidv4();
    let tokens = [];
    if (user.device_token) {
      try {
        tokens = JSON.parse(user.device_token);
        if (!Array.isArray(tokens)) tokens = [user.device_token];
      } catch(e) { tokens = [user.device_token]; }
    }
    tokens.push(newToken);
    await pool.query('UPDATE users SET device_token = $1 WHERE id = $2', [JSON.stringify(tokens), user.id]);
    res.cookie('device_token', newToken, { httpOnly: true, sameSite: 'strict', secure: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('device_token');
  res.json({ success: true });
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.cookie('admin_token', 'admin_authenticated', { httpOnly: true, sameSite: 'strict', secure: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, device_token, created_at FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/admin/users/:id/reset', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE users SET device_token = NULL WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// USUŃ użytkownika
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

app.post('/api/autologin', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const user = await findUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    res.cookie('device_token', token, { httpOnly: true, sameSite: 'strict', secure: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Catch-all
app.use((req, res) => {
  const token = req.cookies.device_token;
  if (!token) return res.redirect('/');
  findUserByToken(token)
    .then(user => {
      if (!user) return res.redirect('/');
      res.redirect('/site');
    })
    .catch(() => res.redirect('/'));
});

app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  initDB();
});