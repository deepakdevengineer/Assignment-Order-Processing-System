const Queue = require('bull');
const { processOrder } = require('../saga/orchestrator');
require('dotenv').config();

const orderQueue = new Queue('order-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

orderQueue.process(10, async (job) => {
  console.log(`Processing job for order ${job.data.order_id}`);
  await processOrder(job.data);
});

console.log('Worker started for queue: order-processing');
