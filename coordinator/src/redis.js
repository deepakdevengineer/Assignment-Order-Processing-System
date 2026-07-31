const Redis = require('ioredis');
require('dotenv').config();

let client = null;
let isConnected = false;

if (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost' && process.env.REDIS_HOST !== '127.0.0.1') {
  try {
    client = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      retryStrategy(times) {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true
    });

    client.on('connect', () => { isConnected = true; console.log('[REDIS] Connected successfully'); });
    client.on('error', (err) => { isConnected = false; console.warn('[REDIS] Connection error:', err.message); });
  } catch (e) {
    console.warn('[REDIS] Failed to initialize Redis client:', e.message);
  }
}

const safeRedis = {
  async get(key) {
    if (!client || !isConnected) return null;
    try {
      return await client.get(key);
    } catch (err) {
      return null;
    }
  },
  async set(key, value, ...args) {
    if (!client || !isConnected) return false;
    try {
      return await client.set(key, value, ...args);
    } catch (err) {
      return false;
    }
  }
};

module.exports = safeRedis;
