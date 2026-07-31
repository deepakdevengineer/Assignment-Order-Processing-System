const mysql = require('mysql2/promise');
require('dotenv').config();

const sslConfig = process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined;

const notificationPool = mysql.createPool({
  host: (process.env.DB_HOST || 'localhost').trim(),
  port: parseInt(process.env.DB_PORT || '3306'),
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || 'root').trim(),
  database: (process.env.DB_NAME || 'defaultdb').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: sslConfig
});

const coordinatorPool = mysql.createPool({
  host: (process.env.DB_HOST || 'localhost').trim(),
  port: parseInt(process.env.DB_PORT || '3306'),
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || 'root').trim(),
  database: (process.env.COORDINATOR_DB_NAME || process.env.DB_NAME || 'defaultdb').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: sslConfig
});

async function initDb() {
  try {
    await notificationPool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(20) NOT NULL UNIQUE,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
    console.log('[NOTIFICATION-SERVICE] DB initialized');
  } catch (err) {
    console.error('[NOTIFICATION-SERVICE] DB init error:', err.message);
  }
}

module.exports = {
  notificationPool,
  coordinatorPool,
  initDb
};
