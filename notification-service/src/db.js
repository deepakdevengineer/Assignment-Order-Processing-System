const mysql = require('mysql2/promise');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || 'root';
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

// Pool for notification_db
const notificationPool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  port: dbPort,
  database: 'notification_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Pool for coordinator_db (read-only queries)
const coordinatorPool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  port: dbPort,
  database: 'coordinator_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ensure notifications table exists in notification_db
async function initDb() {
  try {
    const connection = await notificationPool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
          order_id        VARCHAR(20)     NOT NULL UNIQUE,
          sent_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error initializing notification_db:', err.message);
  }
}

module.exports = {
  notificationPool,
  coordinatorPool,
  initDb
};
