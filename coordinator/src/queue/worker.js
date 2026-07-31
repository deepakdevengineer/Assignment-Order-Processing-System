const Queue = require('bull');
const { processOrder } = require('../saga/orchestrator');
require('dotenv').config();

let orderQueue = null;

if (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost' && process.env.REDIS_HOST !== '127.0.0.1') {
  try {
    orderQueue = new Queue('order-processing', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379
      }
    });

    orderQueue.on('error', (err) => {
      console.warn('[BULL QUEUE] Redis queue error:', err.message);
    });

    orderQueue.process(10, async (job) => {
      console.log(`Processing job for order ${job.data.order_id}`);
      await processOrder(job.data);
    });

    console.log('Worker started for queue: order-processing');
  } catch (e) {
    console.warn('[BULL QUEUE] Could not initialize Bull queue:', e.message);
  }
}

module.exports = orderQueue;
