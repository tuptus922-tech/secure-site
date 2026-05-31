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
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set up the database table — retries in the background until it succeeds
// This function does NOT block the server startup
async function initDB() {
  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 3000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
      console.log('Database ready!');
      return; // success — stop retrying
    } catch (err) {
      console.error(`Database init error (attempt ${attempt}/${MAX_RETRIES}):`, err.message);
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        console.error('Database init failed after all retries. Server continues without DB setup.');
      }
    }
  }
}

app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const token = req.cookies.device_token;
  if (!token) return res.redirect('/');
  pool.query('SELECT * FROM users WHERE device_token = $1', [token])
    .then(result => {
      if (result.rows.length === 0) return res.redirect('/');
      next();
    })
    .catch(() => res.redirect('/'));
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

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid username or password' });
    const newToken = uuidv4();
    if (user.device_token === null) {
      await pool.query('UPDATE users SET device_token = $1 WHERE id = $2', [newToken, user.id]);
      res.cookie('device_token', newToken, { httpOnly: true, sameSite: 'strict', secure: true });
    } else {
      return res.status(403).json({ error: 'This account is already bound to another device' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err.message);
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
    res.cookie('admin_token', 'admin_authenticated', { httpOnly: true, sameSite: 'strict', secure: true });
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

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// Catch-all
app.use((req, res) => {
  const token = req.cookies.device_token;
  if (!token) return res.redirect('/');
  pool.query('SELECT * FROM users WHERE device_token = $1', [token])
    .then(result => {
      if (result.rows.length === 0) return res.redirect('/');
      res.redirect('/site');
    })
    .catch(() => res.redirect('/'));
});

// Globalny handler błędów Express 5
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Start DB init in background — does NOT block server startup
// Use setImmediate to ensure it runs after the event loop is ready
setImmediate(() => {
  initDB().catch(err => console.error('Unexpected initDB error:', err.message));
});

