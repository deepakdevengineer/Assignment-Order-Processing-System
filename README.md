# Order Processing System

A distributed order-processing platform using the **Saga Orchestrator** pattern. It coordinates four independent microservices (Order, Inventory, Payment, Shipping) with fault-tolerance, retry logic, idempotency, and a scheduled Notification service.

## Architecture

```
┌──────────────┐
│   Angular    │ ←── Port 4200
│   Frontend   │
└──────┬───────┘
       │ HTTP
┌──────▼───────┐     ┌────────────────────┐
│  Coordinator │────→│  Redis (cache/queue)│
│  (Port 3000) │     └────────────────────┘
└──┬──┬──┬──┬──┘
   │  │  │  │        HTTP calls (parallel)
   │  │  │  └──→ Shipping Service   (Port 3004) ──→ shipping_db
   │  │  └─────→ Payment Service    (Port 3003) ──→ payment_db
   │  └────────→ Inventory Service  (Port 3002) ──→ inventory_db
   └───────────→ Order Service      (Port 3001) ──→ order_db

┌──────────────────┐
│ Notification Svc │ ←── Port 3005, cron every 15 min
│ (distributed lock)│
└──────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js 20+** and **npm**
- **MySQL 8** running on `localhost:3306` (user: `root`, password: `root`)
- **Redis 7** running on `localhost:6379`

### 1. Initialize the Database

```bash
mysql -u root -proot < mysql-init/01-schema.sql
```

### 2. Install Dependencies (all services)

```bash
# Run from the project root
cd order-service      && npm install && cd ..
cd inventory-service  && npm install && cd ..
cd payment-service    && npm install && cd ..
cd shipping-service   && npm install && cd ..
cd coordinator        && npm install && cd ..
cd notification-service && npm install && cd ..
cd frontend           && npm install && cd ..
```

### 3. Start All Services

Open **7 terminal windows** (or use a process manager):

```bash
# Terminal 1 — Order Service
cd order-service && npm start

# Terminal 2 — Inventory Service
cd inventory-service && npm start

# Terminal 3 — Payment Service
cd payment-service && npm start

# Terminal 4 — Shipping Service
cd shipping-service && npm start

# Terminal 5 — Coordinator
cd coordinator && npm start

# Terminal 6 — Notification Service
cd notification-service && npm start

# Terminal 7 — Angular Frontend
cd frontend && npx ng serve
```

### 4. Open the UI

Navigate to **http://localhost:4200** in your browser.

---

## Docker Compose (Alternative)

If you have Docker Desktop:

```bash
docker-compose up --build
```

This starts MySQL, Redis, all services, and the frontend. Open **http://localhost:4200**.

---

## How to Use

### Upload Orders
1. Go to **Upload CSV** in the sidebar.
2. Drop or select `orders_bulk.csv`.
3. Click **Process Orders** — the coordinator streams the CSV and queues 2,500 orders.

### View Orders
- The **Orders** page shows all orders with real-time status updates (auto-refreshes every 10s).
- Filter by status using the dropdown.
- Click any order ID to see the detail page.

### Order Detail
- Shows the 4 processing steps and their status (Success/Failed/Pending).
- If cancelled, shows compensation (UNDO) steps.
- **Mark Shipped** button on PLACED orders.
- **Retry Failed Undo** button on NEEDS_ATTENTION orders.

### Notifications
- The Notification service runs a cron job every 15 minutes.
- It finds all SHIPPED orders and sends exactly one notification per order.
- View sent notifications on the **Notifications** page.

---

## Key Design Decisions

### Idempotency (Never do a step twice)
- Each service uses `INSERT ... ON DUPLICATE KEY UPDATE` with `order_id` as unique key.
- Coordinator checks Redis cache (`step:{orderId}:{stepName}:DO`) and the `order_steps` DB table before calling a service.

### Parallel Execution
- All 4 steps execute concurrently via `Promise.allSettled()`.
- A Bull queue (Redis-backed) limits concurrency to 10 workers for CSV bulk processing.

### Saga Compensation
- If any step fails after retries → compensations run for succeeded steps.
- If a compensation permanently fails → order marked `NEEDS_ATTENTION`.
- Manual retry button available in the UI.

### Survive Restart
- On startup, coordinator queries orders with status `IN_PROGRESS` and re-processes them.
- Step status in `order_steps` ensures no step is repeated.

### Exactly-Once Notifications
- Redis distributed lock (`SETNX notification-lock`) prevents concurrent cron executions.
- DB-level `UNIQUE` constraint on `notifications.order_id` prevents duplicates.

### Streaming CSV Processing
- Uses Node.js stream (`csv-parser`) — never loads the whole file into memory.
- Processes in batches of 50 rows for efficiency.

---

## Testing

```bash
cd coordinator
npm test
```

Tests cover:
- ✅ All 4 steps succeed → order `PLACED`
- ✅ Step fails → compensations run → order `CANCELLED`
- ✅ Compensation fails → order `NEEDS_ATTENTION`
- ✅ Idempotency: cached/DB-checked steps are not re-executed
- ✅ Retry logic: transient failures retried up to 3 times

---

## Simulated Failures

The `orders_bulk.csv` includes `fail_at` and `comp_fail_at` columns:

| `fail_at` Value | Effect |
|---|---|
| `CREATE_ORDER` | Order service returns 500 |
| `RESERVE_INVENTORY` | Inventory service returns 500 |
| `CHARGE_PAYMENT` | Payment service returns 500 |
| `CREATE_SHIPMENT` | Shipping service returns 500 |

| `comp_fail_at` Value | Effect |
|---|---|
| `CANCEL_ORDER` | Order cancellation returns 500 |
| `RELEASE_INVENTORY` | Inventory release returns 500 |
| `REFUND_PAYMENT` | Payment refund returns 500 |
| `CANCEL_SHIPMENT` | Shipment cancellation returns 500 |

---

## Project Structure

```
avon/
├── coordinator/           # Saga orchestrator + REST API (port 3000)
│   ├── src/
│   │   ├── index.js       # Express app entry
│   │   ├── db.js          # MySQL pool
│   │   ├── redis.js       # Redis client
│   │   ├── routes/orders.js  # REST endpoints
│   │   ├── saga/orchestrator.js  # Core saga logic
│   │   └── queue/worker.js # Bull queue worker
│   └── tests/             # Jest tests
├── order-service/         # Port 3001, order_db
├── inventory-service/     # Port 3002, inventory_db
├── payment-service/       # Port 3003, payment_db
├── shipping-service/      # Port 3004, shipping_db
├── notification-service/  # Port 3005, notification_db + coordinator_db (read)
├── frontend/              # Angular 17 SPA (port 4200)
├── mysql-init/            # SQL schema + seed data
├── docker-compose.yml     # Full orchestration
├── orders_bulk.csv        # 2,500 test orders
└── sample_inventory.csv   # Inventory seed data
```

---

## Ports Summary

| Service | Port |
|---|---|
| Coordinator API | 3000 |
| Order Service | 3001 |
| Inventory Service | 3002 |
| Payment Service | 3003 |
| Shipping Service | 3004 |
| Notification Service | 3005 |
| Angular Frontend | 4200 |
| MySQL | 3306 |
| Redis | 6379 |
