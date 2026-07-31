const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'online', service: 'Inventory Service' }));

app.post('/reservations', async (req, res) => {
  const { order_id, sku, qty, fail_at } = req.body;
  console.log(`[INVENTORY-SERVICE] POST /reservations called for order_id=${order_id}`);

  if (fail_at === 'RESERVE_INVENTORY') {
    console.error(`[INVENTORY-SERVICE] Simulated failure for RESERVE_INVENTORY (order_id: ${order_id})`);
    return res.status(500).json({ error: 'Simulated failure at RESERVE_INVENTORY' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(`SELECT status FROM reservations WHERE order_id = ?`, [order_id]);
    if (existing.length > 0) {
      await connection.commit();
      console.log(`[INVENTORY-SERVICE] Reservation already exists (order_id: ${order_id})`);
      return res.json({ success: true });
    }

    const [updateResult] = await connection.query(
      `UPDATE inventory SET available_qty = available_qty - ? WHERE sku = ? AND available_qty >= ?`,
      [qty, sku, qty]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      console.warn(`[INVENTORY-SERVICE] Insufficient inventory for sku=${sku}`);
      return res.status(400).json({ error: 'Insufficient inventory' });
    }

    await connection.query(
      `INSERT INTO reservations (order_id, sku, qty, status) VALUES (?, ?, ?, 'RESERVED')`,
      [order_id, sku, qty]
    );

    await connection.commit();
    console.log(`[INVENTORY-SERVICE] Inventory reserved (order_id: ${order_id})`);
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error(`[INVENTORY-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

app.delete('/reservations/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { comp_fail_at } = req.body || {};
  
  console.log(`[INVENTORY-SERVICE] DELETE /reservations/${orderId} called`);

  if (comp_fail_at === 'RELEASE_INVENTORY') {
    console.error(`[INVENTORY-SERVICE] Simulated failure for RELEASE_INVENTORY (order_id: ${orderId})`);
    return res.status(500).json({ error: 'Simulated failure at RELEASE_INVENTORY' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [reservations] = await connection.query(`SELECT sku, qty, status FROM reservations WHERE order_id = ?`, [orderId]);
    
    if (reservations.length === 0 || reservations[0].status === 'RELEASED') {
      await connection.commit();
      console.log(`[INVENTORY-SERVICE] Reservation not found or already released (order_id: ${orderId})`);
      return res.json({ success: true });
    }

    const { sku, qty } = reservations[0];

    await connection.query(`UPDATE inventory SET available_qty = available_qty + ? WHERE sku = ?`, [qty, sku]);
    await connection.query(`UPDATE reservations SET status = 'RELEASED' WHERE order_id = ?`, [orderId]);

    await connection.commit();
    console.log(`[INVENTORY-SERVICE] Inventory released (order_id: ${orderId})`);
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error(`[INVENTORY-SERVICE] Database error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    connection.release();
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});
