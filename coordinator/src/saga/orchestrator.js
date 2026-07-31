const db = require('../db');
const redis = require('../redis');
const axios = require('axios');

async function runStep(orderId, stepName, fn, maxRetries = 3, timeoutMs = 5000) {
  const cacheKey = `step:${orderId}:${stepName}:DO`;
  const cachedStatus = await redis.get(cacheKey);
  if (cachedStatus === 'done') {
    return { success: true };
  }

  const [[existing]] = await db.query('SELECT status, response_data FROM order_steps WHERE order_id = ? AND step_name = ?', [orderId, stepName]);
  if (existing && existing.status === 'SUCCESS') {
    await redis.set(cacheKey, 'done');
    return { success: true, data: existing.response_data ? JSON.parse(existing.response_data) : null };
  }

  if (!existing) {
    await db.query('INSERT INTO order_steps (order_id, step_name, status, started_at) VALUES (?, ?, ?, NOW())', [orderId, stepName, 'PENDING']);
  } else {
    await db.query('UPDATE order_steps SET status = ?, updated_at = NOW() WHERE order_id = ? AND step_name = ?', ['PENDING', orderId, stepName]);
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fn(controller.signal);
      clearTimeout(timeoutId);
      
      const responseData = response && response.data ? JSON.stringify(response.data) : null;
      await db.query('UPDATE order_steps SET status = ?, response_data = ?, updated_at = NOW() WHERE order_id = ? AND step_name = ?', ['SUCCESS', responseData, orderId, stepName]);
      await redis.set(cacheKey, 'done');
      
      return { success: true, data: response?.data };
    } catch (error) {
      lastError = error.message;
      if (attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 500));
      }
    }
  }

  await db.query('UPDATE order_steps SET status = ?, error_message = ?, updated_at = NOW() WHERE order_id = ? AND step_name = ?', ['FAILED', lastError, orderId, stepName]);
  return { success: false, error: lastError };
}

async function runCompensation(orderId, stepName, fn, maxRetries = 3, timeoutMs = 5000) {
  const cacheKey = `step:${orderId}:UNDO_${stepName}`;
  const cachedStatus = await redis.get(cacheKey);
  if (cachedStatus === 'done') return { success: true };

  const [[existing]] = await db.query('SELECT status FROM order_steps WHERE order_id = ? AND step_name = ?', [orderId, `UNDO_${stepName}`]);
  if (existing && existing.status === 'SUCCESS') {
    await redis.set(cacheKey, 'done');
    return { success: true };
  }

  if (!existing) {
    await db.query('INSERT INTO order_steps (order_id, step_name, status, started_at) VALUES (?, ?, ?, NOW())', [orderId, `UNDO_${stepName}`, 'PENDING']);
  } else {
    await db.query('UPDATE order_steps SET status = ?, updated_at = NOW() WHERE order_id = ? AND step_name = ?', ['PENDING', orderId, `UNDO_${stepName}`]);
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      await fn(controller.signal);
      clearTimeout(timeoutId);
      
      await db.query('UPDATE order_steps SET status = ?, updated_at = NOW() WHERE order_id = ? AND step_name = ?', ['SUCCESS', orderId, `UNDO_${stepName}`]);
      await redis.set(cacheKey, 'done');
      
      return { success: true };
    } catch (error) {
      lastError = error.message;
      if (attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 500));
      }
    }
  }

  await db.query('UPDATE order_steps SET status = ?, error_message = ?, updated_at = NOW() WHERE order_id = ? AND step_name = ?', ['FAILED', lastError, orderId, `UNDO_${stepName}`]);
  return { success: false, error: lastError };
}

async function processOrder(order) {
  const orderId = order.order_id;
  const failAt = order.fail_at;
  const compFailAt = order.comp_fail_at;
  
  const steps = [
    {
      name: 'CREATE_ORDER',
      fn: (signal) => axios.post(`${process.env.ORDER_SERVICE_URL}/orders`, { order_id: orderId, sku: order.sku, qty: order.qty, amount: order.amount, fail_at: failAt }, { signal })
    },
    {
      name: 'RESERVE_INVENTORY',
      fn: (signal) => axios.post(`${process.env.INVENTORY_SERVICE_URL}/reservations`, { order_id: orderId, sku: order.sku, qty: order.qty, fail_at: failAt }, { signal })
    },
    {
      name: 'CHARGE_PAYMENT',
      fn: (signal) => axios.post(`${process.env.PAYMENT_SERVICE_URL}/charges`, { order_id: orderId, amount: order.amount, fail_at: failAt }, { signal })
    },
    {
      name: 'CREATE_SHIPMENT',
      fn: (signal) => axios.post(`${process.env.SHIPPING_SERVICE_URL}/shipments`, { order_id: orderId, sku: order.sku, qty: order.qty, fail_at: failAt }, { signal })
    }
  ];

  const results = await Promise.allSettled(steps.map(step => runStep(orderId, step.name, step.fn)));
  
  const allSucceeded = results.every(r => r.status === 'fulfilled' && r.value.success);

  if (allSucceeded) {
    await db.query('UPDATE orders SET status = "PLACED" WHERE order_id = ?', [orderId]);
    return;
  }

  const compensations = [];
  for (let i = 0; i < steps.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value.success) {
      const stepName = steps[i].name;
      const data = result.value.data || {};
      
      let compFn;
      if (stepName === 'CREATE_ORDER') {
        compFn = (signal) => axios.delete(`${process.env.ORDER_SERVICE_URL}/orders/${orderId}`, { data: { comp_fail_at: compFailAt }, signal });
      } else if (stepName === 'RESERVE_INVENTORY') {
        const id = data.id || orderId;
        compFn = (signal) => axios.delete(`${process.env.INVENTORY_SERVICE_URL}/reservations/${id}`, { data: { comp_fail_at: compFailAt }, signal });
      } else if (stepName === 'CHARGE_PAYMENT') {
        const id = data.id || orderId;
        compFn = (signal) => axios.delete(`${process.env.PAYMENT_SERVICE_URL}/charges/${id}`, { data: { comp_fail_at: compFailAt }, signal });
      } else if (stepName === 'CREATE_SHIPMENT') {
        const id = data.id || orderId;
        compFn = (signal) => axios.delete(`${process.env.SHIPPING_SERVICE_URL}/shipments/${id}`, { data: { comp_fail_at: compFailAt }, signal });
      }

      if (compFn) {
        compensations.push(runCompensation(orderId, stepName, compFn));
      }
    }
  }

  if (compensations.length > 0) {
    const compResults = await Promise.allSettled(compensations);
    const allCompsSucceeded = compResults.every(r => r.status === 'fulfilled' && r.value.success);
    
    if (allCompsSucceeded) {
      await db.query('UPDATE orders SET status = "CANCELLED" WHERE order_id = ?', [orderId]);
    } else {
      await db.query('UPDATE orders SET status = "NEEDS_ATTENTION" WHERE order_id = ?', [orderId]);
    }
  } else {
    await db.query('UPDATE orders SET status = "CANCELLED" WHERE order_id = ?', [orderId]);
  }
}

async function recoverInProgressOrders() {
  const [orders] = await db.query('SELECT * FROM orders WHERE status = "IN_PROGRESS"');
  for (const order of orders) {
    console.log(`Recovering order ${order.order_id}`);
    processOrder(order).catch(err => console.error(`Failed recovering order ${order.order_id}`, err));
  }
}

module.exports = {
  processOrder,
  runStep,
  runCompensation,
  recoverInProgressOrders
};
