const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: (process.env.DB_HOST || 'localhost').trim(),
  port: parseInt(process.env.DB_PORT || '3306'),
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || 'root').trim(),
  database: (process.env.DB_NAME || 'defaultdb').trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' ? { rejectUnauthorized: false } : undefined
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        sku VARCHAR(50) PRIMARY KEY,
        available_qty INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        order_id VARCHAR(20) PRIMARY KEY,
        sku VARCHAR(50) NOT NULL,
        qty INT NOT NULL,
        status ENUM('RESERVED','RELEASED') NOT NULL DEFAULT 'RESERVED',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      INSERT INTO inventory (sku, available_qty) VALUES
        ('WIDGET-A', 50000), ('WIDGET-B', 50000), ('GADGET-X', 50000),
        ('GIZMO-PRO', 50000), ('SENSOR-T1', 50000), ('MODULE-Z', 50000),
        ('CABLE-2M', 50000), ('ADAPTER-USB-C', 50000), ('BATTERY-AA', 50000),
        ('PANEL-40W', 50000)
      ON DUPLICATE KEY UPDATE available_qty = VALUES(available_qty);
    `);
    console.log('[INVENTORY-SERVICE] DB tables & stock initialized');
  } catch (err) {
    console.error('[INVENTORY-SERVICE] DB init error:', err.message);
  }
}

module.exports = pool;
module.exports.initDb = initDb;
