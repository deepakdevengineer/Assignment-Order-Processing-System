require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ordersRouter = require('./routes/orders');
const { recoverInProgressOrders } = require('./saga/orchestrator');
require('./queue/worker'); 

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/orders', ordersRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Coordinator service running on port ${PORT}`);
  try {
    await recoverInProgressOrders();
    console.log('Finished recovering in-progress orders');
  } catch (err) {
    console.error('Error recovering orders:', err);
  }
});
