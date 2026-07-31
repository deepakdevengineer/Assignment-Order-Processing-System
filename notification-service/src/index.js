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

// Redis client setup with graceful fallback
let redis = null;
if (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost' && process.env.REDIS_HOST !== '127.0.0.1') {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true
    });
    redis.on('error', (err) => console.warn('[NOTIFICATION] Redis warning:', err.message));
  } catch (e) {
    console.warn('[NOTIFICATION] Redis client disabled:', e.message);
  }
}

let lastRun = null;

// Cron job execution function
async function runNotificationJob() {
  const lockKey = 'notification-lock';
  const lockUuid = randomUUID();
  const lockTtl = 60; // 60 seconds TTL

  let acquired = true; // Default to true if Redis is offline
  if (redis) {
    try {
      const result = await redis.set(lockKey, lockUuid, 'EX', lockTtl, 'NX');
      if (result !== 'OK') {
        acquired = false;
      }
    } catch (err) {
      console.warn('[NOTIFICATION] Redis lock failed, falling back to DB uniqueness:', err.message);
      acquired = true;
    }
  }

  if (!acquired) {
    console.log('[NOTIFICATION] Lock not acquired, skipping this run.');
    return;
  }

  lastRun = new Date().toISOString();

  try {
    // Query coordinator orders marked as PLACED or SHIPPED
    const [orders] = await coordinatorPool.query(
      "SELECT order_id FROM orders WHERE status IN ('PLACED', 'SHIPPED')"
    );

    for (const order of orders) {
      const orderId = order.order_id;

      // Use INSERT IGNORE for exactly-once notification guarantee
      const [result] = await notificationPool.query(
        "INSERT IGNORE INTO notifications (order_id) VALUES (?)",
        [orderId]
      );

      if (result.affectedRows > 0) {
        console.log(`[NOTIFICATION] Sent notification for order ${orderId}`);
      }
    }
  } catch (err) {
    console.error('[NOTIFICATION] Error during notification job execution:', err.message);
  } finally {
    if (redis && acquired) {
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
        // Silently ignore release errors
      }
    }
  }
}

// GET /api/notifications -> returns all sent notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const [notifications] = await notificationPool.query(
      "SELECT id, order_id, sent_at FROM notifications ORDER BY sent_at DESC, id DESC"
    );
    res.json(notifications || []);
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
    const totalSent = rows && rows[0] ? Number(rows[0].totalSent) : 0;
    res.json({
      lastRun: lastRun,
      totalSent: totalSent
    });
  } catch (err) {
    console.error('[NOTIFICATION] Error fetching status:', err.message);
    res.status(500).json({ error: 'Failed to fetch notification status' });
  }
});

// POST /api/notifications/trigger -> manually trigger notification job
app.post('/api/notifications/trigger', async (req, res) => {
  try {
    await runNotificationJob();
    res.json({ message: 'Notification job triggered successfully', lastRun });
  } catch (err) {
    console.error('[NOTIFICATION] Manual trigger failed:', err.message);
    res.status(500).json({ error: 'Failed to trigger notification job' });
  }
});

// Schedule cron job to run every minute (*/1 * * * *)
cron.schedule('*/1 * * * *', () => {
  console.log('[NOTIFICATION] Running 1-minute cron job...');
  runNotificationJob().catch(err => {
    console.error('[NOTIFICATION] Cron job execution failed:', err.message);
  });
});

// Start Express server
async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[NOTIFICATION SERVICE] Express server listening on port ${PORT}`);
    // Run initial notification job on startup
    runNotificationJob().catch(err => console.error('[NOTIFICATION] Startup job error:', err.message));
  });
}

startServer().catch(err => {
  console.error('[NOTIFICATION SERVICE] Startup error:', err);
});
