const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const { initDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'online', service: 'Order Service' }));

app.post('/orders', async (req, res) => {
  const { order_id, sku, qty, amount, fail_at } = req.body;
  console.log(`[ORDER-SERVICE] POST /orders called with order_id=${order_id}`);

  if (fail_at === 'CREATE_ORDER') {
    console.error(`[ORDER-SERVICE] Simulated failure for CREATE_ORDER (order_id: ${order_id})`);
    return res.status(500).json({ error: 'Simulated failure at CREATE_ORDER' });
  }

  try {
    await db.query(
      `INSERT INTO service_orders (order_id, sku, qty, amount, status) 
       VALUES (?, ?, ?, ?, 'CREATED') 
       ON DUPLICATE KEY UPDATE status=status`,
      [order_id, sku, qty, amount]
    );

    console.log(`[ORDER-SERVICE] Order created/already exists (order_id: ${order_id})`);
    res.json({ success: true, order_id });
  } catch (error) {
    console.error(`[ORDER-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { comp_fail_at } = req.body;
  
  console.log(`[ORDER-SERVICE] DELETE /orders/${orderId} called`);

  if (comp_fail_at === 'CANCEL_ORDER') {
    console.error(`[ORDER-SERVICE] Simulated failure for CANCEL_ORDER (order_id: ${orderId})`);
    return res.status(500).json({ error: 'Simulated failure at CANCEL_ORDER' });
  }

  try {
    await db.query(`UPDATE service_orders SET status = 'CANCELLED' WHERE order_id = ?`, [orderId]);
    console.log(`[ORDER-SERVICE] Order cancelled (order_id: ${orderId})`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ORDER-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  await initDb();
  console.log(`Order Service running on port ${PORT}`);
});
