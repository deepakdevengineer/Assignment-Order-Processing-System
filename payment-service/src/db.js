const mysql = require('mysql2/promise');
require('dotenv').config();

const defaultPass = Buffer.from('QVZOU19CdjhjZy1KWXpqUE9IZFlvaGRC', 'base64').toString('utf-8');
const dbPassword = (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim().length > 0) 
  ? process.env.DB_PASSWORD.trim() 
  : defaultPass;

const pool = mysql.createPool({
  host: (process.env.DB_HOST || 'mysql-2092d28a-dk78834-169f.b.aivencloud.com').trim(),
  port: parseInt(process.env.DB_PORT || '19577'),
  user: (process.env.DB_USER || 'avnadmin').trim(),
  password: dbPassword,
  database: (process.env.DB_NAME || 'defaultdb').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
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
