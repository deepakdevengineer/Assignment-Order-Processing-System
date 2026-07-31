const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const Redis = require('ioredis');
const { randomUUID } = require('crypto');
require('dotenv').config();

const { notificationPool, coordinatorPool, initDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'online', service: 'Notification Service' }));

const PORT = process.env.PORT || 3005;

// Redis client setup
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  }
});

redis.on('error', (err) => {
  console.error('[NOTIFICATION] Redis error:', err.message);
});

let lastRun = null;

// Cron job execution function
async function runNotificationJob() {
  const lockKey = 'notification-lock';
  const lockUuid = randomUUID();
  const lockTtl = 60; // 60 seconds TTL

  let acquired = false;
  try {
    const result = await redis.set(lockKey, lockUuid, 'EX', lockTtl, 'NX');
    if (result === 'OK') {
      acquired = true;
    }
  } catch (err) {
    console.error('[NOTIFICATION] Error acquiring Redis lock:', err.message);
    return;
  }

  if (!acquired) {
    console.log('[NOTIFICATION] Lock not acquired, skipping this run.');
    return;
  }

  lastRun = new Date().toISOString();

  try {
    // Query coordinator_db.orders for orders marked as SHIPPED
    const [shippedOrders] = await coordinatorPool.query(
      "SELECT order_id FROM orders WHERE status = 'SHIPPED'"
    );

    for (const order of shippedOrders) {
      const orderId = order.order_id;

      // Check notification_db.notifications for existing entry
      const [existing] = await notificationPool.query(
        "SELECT id FROM notifications WHERE order_id = ?",
        [orderId]
      );

      if (existing.length === 0) {
        // Use INSERT IGNORE for safety (UNIQUE key on order_id prevents duplicates even if two instances race)
        const [result] = await notificationPool.query(
          "INSERT IGNORE INTO notifications (order_id) VALUES (?)",
          [orderId]
        );

        if (result.affectedRows > 0) {
          console.log(`[NOTIFICATION] Sent notification for order ${orderId}`);
        }
      }
    }
  } catch (err) {
    console.error('[NOTIFICATION] Error during notification job execution:', err.message);
  } finally {
    // Release the lock: DEL notification-lock (only if value matches our uuid)
    const releaseLua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redis.eval(releaseLua, 1, lockKey, lockUuid);
    } catch (err) {
      console.error('[NOTIFICATION] Error releasing Redis lock:', err.message);
    }
  }
}

// GET /api/notifications -> returns all sent notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const [notifications] = await notificationPool.query(
      "SELECT id, order_id, sent_at FROM notifications ORDER BY sent_at DESC, id DESC"
    );
    res.json(notifications);
  } catch (err) {
    console.error('[NOTIFICATION] Error fetching notifications:', err.message);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/status -> returns { lastRun: <timestamp>, totalSent: N }
app.get('/api/notifications/status', async (req, res) => {
  try {
    const [rows] = await notificationPool.query(
      "SELECT COUNT(*) AS totalSent FROM notifications"
    );
    const totalSent = rows[0] ? Number(rows[0].totalSent) : 0;
    res.json({
      lastRun: lastRun,
      totalSent: totalSent
    });
  } catch (err) {
    console.error('[NOTIFICATION] Error fetching status:', err.message);
    res.status(500).json({ error: 'Failed to fetch notification status' });
  }
});

// POST /api/notifications/trigger -> manually trigger notification job (useful for testing/admin)
app.post('/api/notifications/trigger', async (req, res) => {
  try {
    await runNotificationJob();
    res.json({ message: 'Notification job triggered successfully', lastRun });
  } catch (err) {
    console.error('[NOTIFICATION] Manual trigger failed:', err.message);
    res.status(500).json({ error: 'Failed to trigger notification job' });
  }
});

// Schedule cron job to run every 15 minutes (*/15 * * * *)
cron.schedule('*/15 * * * *', () => {
  console.log('[NOTIFICATION] Running scheduled 15-minute cron job...');
  runNotificationJob().catch(err => {
    console.error('[NOTIFICATION] Cron job execution failed:', err.message);
  });
});

// Start Express server
async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[NOTIFICATION SERVICE] Express server listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[NOTIFICATION SERVICE] Startup error:', err);
});
