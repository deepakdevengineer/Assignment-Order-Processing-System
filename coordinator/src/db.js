const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: (process.env.DB_HOST || 'localhost').trim(),
  port: parseInt(process.env.DB_PORT || '3306'),
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || 'root').trim(),
  database: (process.env.DB_NAME || 'coordinator_db').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined,
  multipleStatements: true
});

async function initDb() {
  try {
    console.log('[COORDINATOR] Ensuring database tables exist...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id VARCHAR(20) PRIMARY KEY,
        sku VARCHAR(50) NOT NULL,
        qty INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status ENUM('IN_PROGRESS','PLACED','SHIPPED','CANCELLED','NEEDS_ATTENTION') NOT NULL DEFAULT 'IN_PROGRESS',
        fail_at VARCHAR(50) DEFAULT NULL,
        comp_fail_at VARCHAR(50) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_steps (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(20) NOT NULL,
        step_name VARCHAR(50) NOT NULL,
        status ENUM('PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'PENDING',
        response_data TEXT DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_order_step (order_id, step_name),
        INDEX idx_order_id (order_id),
        CONSTRAINT fk_os_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('[COORDINATOR] Database tables verified successfully');
  } catch (err) {
    console.error('[COORDINATOR] Error initializing DB tables:', err.message);
  }
}

module.exports = pool;
module.exports.initDb = initDb;
