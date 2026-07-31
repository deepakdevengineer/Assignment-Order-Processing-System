const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'online', service: 'Shipping Service' }));

app.post('/shipments', async (req, res) => {
  const { order_id, sku, qty, fail_at } = req.body;
  console.log(`[SHIPPING-SERVICE] POST /shipments called for order_id=${order_id}`);

  if (fail_at === 'CREATE_SHIPMENT') {
    console.error(`[SHIPPING-SERVICE] Simulated failure for CREATE_SHIPMENT (order_id: ${order_id})`);
    return res.status(500).json({ error: 'Simulated failure at CREATE_SHIPMENT' });
  }

  try {
    await db.query(
      `INSERT INTO shipments (order_id, sku, qty, status) 
       VALUES (?, ?, ?, 'CREATED') 
       ON DUPLICATE KEY UPDATE status=status`,
      [order_id, sku, qty]
    );

    console.log(`[SHIPPING-SERVICE] Shipment created (order_id: ${order_id})`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[SHIPPING-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/shipments/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { comp_fail_at } = req.body || {};
  
  console.log(`[SHIPPING-SERVICE] DELETE /shipments/${orderId} called`);

  if (comp_fail_at === 'CANCEL_SHIPMENT') {
    console.error(`[SHIPPING-SERVICE] Simulated failure for CANCEL_SHIPMENT (order_id: ${orderId})`);
    return res.status(500).json({ error: 'Simulated failure at CANCEL_SHIPMENT' });
  }

  try {
    await db.query(`UPDATE shipments SET status = 'CANCELLED' WHERE order_id = ?`, [orderId]);
    console.log(`[SHIPPING-SERVICE] Shipment cancelled (order_id: ${orderId})`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[SHIPPING-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Shipping Service running on port ${PORT}`);
});
