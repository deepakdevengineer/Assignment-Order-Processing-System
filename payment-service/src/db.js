const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'payment_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS charges (
        order_id VARCHAR(20) PRIMARY KEY,
        amount DECIMAL(12,2) NOT NULL,
        status ENUM('CHARGED','REFUNDED') NOT NULL DEFAULT 'CHARGED',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
    console.log('[PAYMENT-SERVICE] DB tables initialized');
  } catch (err) {
    console.error('[PAYMENT-SERVICE] DB init error:', err.message);
  }
}

module.exports = pool;
module.exports.initDb = initDb;
