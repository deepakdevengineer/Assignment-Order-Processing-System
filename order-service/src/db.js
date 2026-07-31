const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: (process.env.DB_HOST || 'localhost').trim(),
  port: parseInt(process.env.DB_PORT || '3306'),
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || 'root').trim(),
  database: (process.env.DB_NAME || 'order_db').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_orders (
        order_id VARCHAR(20) PRIMARY KEY,
        sku VARCHAR(50) NOT NULL,
        qty INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status ENUM('CREATED','CANCELLED') NOT NULL DEFAULT 'CREATED',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
    console.log('[ORDER-SERVICE] DB tables initialized');
  } catch (err) {
    console.error('[ORDER-SERVICE] DB init error:', err.message);
  }
}

module.exports = pool;
module.exports.initDb = initDb;
