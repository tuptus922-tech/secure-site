require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const db = new Database('database.db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    device_token TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Pliki publiczne (login.html, admin-login.html)
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const token = req.cookies.device_token;
  if (!token) return res.redirect('/');
  const user = db.prepare('SELECT * FROM users WHERE device_token = ?').get(token);
  if (!user) return res.redirect('/');
  next();
}

function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (token !== 'admin_authenticated') return res.redirect('/admin-login.html');
  next();
}

// ===== TRASY PUBLICZNE =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// ===== API =====
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  const passwordMatch = bcrypt.compareSync(password, user.password);
  if (!passwordMatch) return res.status(401).json({ error: 'Invalid username or password' });
  const newToken = uuidv4();
  if (user.device_token === null) {
    db.prepare('UPDATE users SET device_token = ? WHERE id = ?').run(newToken, user.id);
    res.cookie('device_token', newToken, { httpOnly: true, sameSite: 'strict', secure: true });
  } else {
    return res.status(403).json({ error: 'This account is already bound to another device' });
  }
  res.json({ success: true });
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

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, device_token, created_at FROM users').all();
  res.json(users);
});

app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/admin/users/:id/reset', requireAdmin, (req, res) => {
  db.prepare('UPDATE users SET device_token = NULL WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

// ===== ADMIN PANEL =====
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'protected', 'admin.html'));
});

// ===== CHRONIONA STRONA =====
const SITE_PATH = '/home/tuptus/Pobrane/dowodplska-main';

app.use('/site', requireAuth, express.static(SITE_PATH));

app.get('/site', requireAuth, (req, res) => {
  res.sendFile(path.join(SITE_PATH, 'index.html'));
});

// ===== CATCH-ALL (MUSI BYĆ NA SAMYM DOLE!) =====
app.use((req, res) => {
  const token = req.cookies.device_token;
  if (!token) return res.redirect('/');
  const user = db.prepare('SELECT * FROM users WHERE device_token = ?').get(token);
  if (!user) return res.redirect('/');
  res.redirect('/site');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});