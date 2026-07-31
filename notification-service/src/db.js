const mysql = require('mysql2/promise');
require('dotenv').config();

const defaultPass = Buffer.from('QVZOU19CdjhjZy1KWXpqUE9IZFlvaGRC', 'base64').toString('utf-8');
const dbPassword = (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim().length > 0) 
  ? process.env.DB_PASSWORD.trim() 
  : defaultPass;

const sslConfig = { rejectUnauthorized: false };

const notificationPool = mysql.createPool({
  host: (process.env.DB_HOST || 'mysql-2092d28a-dk78834-169f.b.aivencloud.com').trim(),
  port: parseInt(process.env.DB_PORT || '19577'),
  user: (process.env.DB_USER || 'avnadmin').trim(),
  password: dbPassword,
  database: (process.env.DB_NAME || 'defaultdb').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: sslConfig
});

const coordinatorPool = mysql.createPool({
  host: (process.env.DB_HOST || 'mysql-2092d28a-dk78834-169f.b.aivencloud.com').trim(),
  port: parseInt(process.env.DB_PORT || '19577'),
  user: (process.env.DB_USER || 'avnadmin').trim(),
  password: dbPassword,
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
