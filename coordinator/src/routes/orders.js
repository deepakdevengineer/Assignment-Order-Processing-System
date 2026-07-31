const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../db');
require('dotenv').config();

const upload = multer({ dest: 'uploads/' });

router.get('/health-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 as ok');
    res.json({ status: 'ok', db: 'connected', result: rows });
  } catch (error) {
    res.status(200).json({
      status: 'error',
      message: error.message,
      code: error.code,
      errno: error.errno,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let countQuery = 'SELECT COUNT(*) as total FROM orders';
    let countParams = [];
    let whereClause = '';

    if (status) {
      whereClause = ' WHERE status = ?';
      countQuery += whereClause;
      countParams.push(status);
    }

    const [countRows] = await db.query(countQuery, countParams);
    const total = (countRows && countRows[0] && countRows[0].total !== undefined) ? Number(countRows[0].total) : 0;

    let dataQuery = `SELECT * FROM orders${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [orders] = await db.query(dataQuery, countParams);

    res.json({
      orders: orders || [],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    console.error('[COORDINATOR API ERROR] /api/orders:', error);
    res.json({
      error: error.message,
      code: error.code,
      orders: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [req.params.id]);
    const order = orders && orders[0] ? orders[0] : null;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [steps] = await db.query('SELECT * FROM order_steps WHERE order_id = ? ORDER BY started_at ASC', [req.params.id]);
    res.json({ order, steps: steps || [] });
  } catch (error) {
    console.error('[COORDINATOR API ERROR] /api/orders/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const rows = [];
  const { processOrder } = require('../saga/orchestrator');

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    try { fs.unlinkSync(req.file.path); } catch (e) {}

    let totalQueued = 0;
    let skipped = 0;

    for (const item of rows) {
      if (!item.order_id) continue;
      try {
        const [existing] = await db.query('SELECT order_id FROM orders WHERE order_id = ?', [item.order_id]);
        if (existing && existing.length > 0) {
          skipped++;
        } else {
          await db.query(
            'INSERT INTO orders (order_id, sku, qty, amount, status, fail_at, comp_fail_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [item.order_id, item.sku, parseInt(item.qty) || 1, parseFloat(item.amount) || 0, 'IN_PROGRESS', item.fail_at || null, item.comp_fail_at || null]
          );
          totalQueued++;

          // Asynchronously trigger saga orchestrator for each order
          processOrder(item).catch(err => console.error(`[SAGA ERROR] Order ${item.order_id}:`, err.message));
        }
      } catch (err) {
        console.error('[UPLOAD ROW ERROR]:', item.order_id, err.message);
      }
    }

    res.json({ message: 'Upload completed', totalQueued, skipped });
  } catch (error) {
    console.error('[COORDINATOR CSV UPLOAD ERROR]:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/ship', async (req, res) => {
  try {
    const [result] = await db.query('UPDATE orders SET status = "SHIPPED" WHERE order_id = ? AND status = "PLACED"', [req.params.id]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Order not found or not in PLACED status' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const [orders] = await db.query('SELECT * FROM orders WHERE order_id = ?', [id]);
    const order = orders && orders[0] ? orders[0] : null;
    if (!order || order.status !== 'NEEDS_ATTENTION') {
      return res.status(400).json({ error: 'Order not found or not NEEDS_ATTENTION' });
    }

    const [steps] = await db.query('SELECT * FROM order_steps WHERE order_id = ?', [id]);
    const failedUndoSteps = (steps || []).filter(s => s.status === 'FAILED' && s.step_name.startsWith('UNDO_'));
    
    if (failedUndoSteps.length === 0) {
      return res.status(400).json({ error: 'No failed UNDO steps found' });
    }

    const { runCompensation } = require('../saga/orchestrator');
    let anyFailed = false;

    for (const step of failedUndoSteps) {
      const stepName = step.step_name.replace('UNDO_', '');
      let result = null;
      if (stepName === 'CREATE_ORDER') {
        result = await runCompensation(id, 'CREATE_ORDER', async () => require('axios').delete(`${process.env.ORDER_SERVICE_URL}/orders/${id}`, { data: { comp_fail_at: order.comp_fail_at } }));
      } else if (stepName === 'RESERVE_INVENTORY') {
        const [invSteps] = await db.query('SELECT response_data FROM order_steps WHERE order_id = ? AND step_name = ?', [id, 'RESERVE_INVENTORY']);
        const invStep = invSteps && invSteps[0] ? invSteps[0] : null;
        const resData = invStep?.response_data ? JSON.parse(invStep.response_data) : {};
        const resId = resData.id || id; 
        result = await runCompensation(id, 'RESERVE_INVENTORY', async () => require('axios').delete(`${process.env.INVENTORY_SERVICE_URL}/reservations/${resId}`, { data: { comp_fail_at: order.comp_fail_at } }));
      } else if (stepName === 'CHARGE_PAYMENT') {
        const [paySteps] = await db.query('SELECT response_data FROM order_steps WHERE order_id = ? AND step_name = ?', [id, 'CHARGE_PAYMENT']);
        const payStep = paySteps && paySteps[0] ? paySteps[0] : null;
        const resData = payStep?.response_data ? JSON.parse(payStep.response_data) : {};
        const resId = resData.id || id;
        result = await runCompensation(id, 'CHARGE_PAYMENT', async () => require('axios').delete(`${process.env.PAYMENT_SERVICE_URL}/charges/${resId}`, { data: { comp_fail_at: order.comp_fail_at } }));
      } else if (stepName === 'CREATE_SHIPMENT') {
        const [shipSteps] = await db.query('SELECT response_data FROM order_steps WHERE order_id = ? AND step_name = ?', [id, 'CREATE_SHIPMENT']);
        const shipStep = shipSteps && shipSteps[0] ? shipSteps[0] : null;
        const resData = shipStep?.response_data ? JSON.parse(shipStep.response_data) : {};
        const resId = resData.id || id;
        result = await runCompensation(id, 'CREATE_SHIPMENT', async () => require('axios').delete(`${process.env.SHIPPING_SERVICE_URL}/shipments/${resId}`, { data: { comp_fail_at: order.comp_fail_at } }));
      }
      
      if (result && !result.success) {
        anyFailed = true;
      }
    }

    if (!anyFailed) {
      await db.query('UPDATE orders SET status = "CANCELLED" WHERE order_id = ?', [id]);
      res.json({ success: true, message: 'All compensations succeeded, order CANCELLED' });
    } else {
      res.json({ success: false, message: 'Some compensations failed again, order still NEEDS_ATTENTION' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
