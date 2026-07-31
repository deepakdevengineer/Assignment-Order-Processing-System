const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/charges', async (req, res) => {
  const { order_id, amount, fail_at } = req.body;
  console.log(`[PAYMENT-SERVICE] POST /charges called for order_id=${order_id}`);

  if (fail_at === 'CHARGE_PAYMENT') {
    console.error(`[PAYMENT-SERVICE] Simulated failure for CHARGE_PAYMENT (order_id: ${order_id})`);
    return res.status(500).json({ error: 'Simulated failure at CHARGE_PAYMENT' });
  }

  try {
    await db.query(
      `INSERT INTO charges (order_id, amount, status) 
       VALUES (?, ?, 'CHARGED') 
       ON DUPLICATE KEY UPDATE status=status`,
      [order_id, amount]
    );

    console.log(`[PAYMENT-SERVICE] Payment charged (order_id: ${order_id})`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[PAYMENT-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/charges/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { comp_fail_at } = req.body || {};
  
  console.log(`[PAYMENT-SERVICE] DELETE /charges/${orderId} called`);

  if (comp_fail_at === 'REFUND_PAYMENT') {
    console.error(`[PAYMENT-SERVICE] Simulated failure for REFUND_PAYMENT (order_id: ${orderId})`);
    return res.status(500).json({ error: 'Simulated failure at REFUND_PAYMENT' });
  }

  try {
    await db.query(`UPDATE charges SET status = 'REFUNDED' WHERE order_id = ?`, [orderId]);
    console.log(`[PAYMENT-SERVICE] Payment refunded (order_id: ${orderId})`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[PAYMENT-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});
