const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('database.db');

// ← ZMIEŃ TE DWIE WARTOŚCI
const USERNAME = 'testuser';
const PASSWORD = 'mojehaslo123';

// Zaszyfruj hasło i dodaj użytkownika
const hashedPassword = bcrypt.hashSync(PASSWORD, 10);

try {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(USERNAME, hashedPassword);
  console.log(`✅ Użytkownik "${USERNAME}" dodany pomyślnie!`);
} catch (err) {
  console.log(`❌ Błąd: ${err.message}`);
}

db.close();