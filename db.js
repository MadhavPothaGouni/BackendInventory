const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "inventory.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Could not connect to SQLite:", err);
  } else {
    console.log(`Connected to SQLite database at ${dbPath}`);
  }
});

db.serialize(() => {
  // USERS TABLE (for authentication)
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );

  // PRODUCTS TABLE
  db.run(
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      image TEXT
    )`
  );

  // INVENTORY LOGS TABLE
  db.run(
    `CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      old_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      changed_by TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`
  );
});

module.exports = db;
