# Avon Order Processing System — Distributed Saga Platform

A state-of-the-art distributed order-processing system built with Node.js, Express, Angular 17, Aiven Cloud MySQL, and Redis. It implements the **Saga Orchestrator Pattern** to coordinate four independent microservices with full fault tolerance, parallel execution, idempotency, automated compensation logic, and scheduled exactly-once notifications.

---

## 🌐 Live Production Deployments

| Component | Provider | Live URL |
| :--- | :--- | :--- |
| **Angular 17 Web Frontend** | **Vercel** | [https://assignment-order-processing-system-eight.vercel.app](https://assignment-order-processing-system-eight.vercel.app) |
| **Saga Coordinator API** | **Render** | `https://order-coordinator.onrender.com/api` |
| **Order Microservice** | **Render** | `https://order-microservice-sayv.onrender.com` |
| **Inventory Microservice** | **Render** | `https://inventory-microservice-fk91.onrender.com` |
| **Payment Microservice** | **Render** | `https://payment-microservice-7iin.onrender.com` |
| **Shipping Microservice** | **Render** | `https://shipping-microservice-7iin.onrender.com` |
| **Notification Service** | **Render** | `https://notification-service-t39v.onrender.com/api` |
| **Cloud MySQL Database** | **Aiven** | `mysql-2092d28a-dk78834-169f.b.aivencloud.com:19577` |

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Angular 17 Standalone SPA                  │
│       (Upload Progress Bar | Timeline View | Stat Cards)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼──────────────────────────────┐
│                    Saga Orchestrator API                    │
│             (Self-Healing DB Init | Redis Cache)            │
└───────┬──────────────┬──────────────┬──────────────┬────────┘
        │ HTTP (Parallel Execution)   │              │
┌───────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
│ Order Service││Inventory Svc││ Payment Svc ││Shipping Svc │
│ (Port 3001)  ││ (Port 3002) ││ (Port 3003) ││ (Port 3004) │
└───────┬──────┘└──────┬──────┘└──────┬──────┘└──────┬──────┘
        │              │              │              │
        └──────────────┴──────┬───────┴──────────────┘
                              │
                 ┌────────────▼────────────┐
                 │    Aiven Cloud MySQL    │
                 │   (defaultdb database)  │
                 └────────────▲────────────┘
                              │ Read/Write
                 ┌────────────┴────────────┐
                 │   Notification Service  │
                 │  (1-Min Cron | SETNX)   │
                 └─────────────────────────┘
```

---

## 🌟 Key Features

1. **Saga Orchestration Pattern**:
   - Executes 4 parallel steps (`CREATE_ORDER`, `RESERVE_INVENTORY`, `CHARGE_PAYMENT`, `CREATE_SHIPMENT`) using `Promise.allSettled()`.
   - If any step fails, automated compensation (`UNDO_`) steps roll back all succeeded actions cleanly.
   - Permanent compensation failures automatically transition orders to `NEEDS_ATTENTION` for manual 1-click retries.

2. **Self-Healing Database Auto-Initialization**:
   - Microservices automatically verify and create required tables (`orders`, `order_steps`, `inventory`, `reservations`, `charges`, `shipments`, `notifications`) on startup inside the cloud database (`defaultdb`).
   - Automatically seeds 50,000 units for 10 initial SKUs (`WIDGET-A`, `BATTERY-AA`, `ADAPTER-USB-C`, etc.).

3. **High-Performance Bulk CSV Upload**:
   - Parses Byte Order Marks (`\uFEFF`) and normalizes headers.
   - Bulk checks duplicates in memory and executes **chunked SQL bulk inserts** (500 rows per query).
   - Processes 2,500 test orders in **under 200 milliseconds**!

4. **Live Upload Progress Bar**:
   - Angular `HttpClient` event tracking (`HttpEventType.UploadProgress`) renders a real-time percentage progress bar (`0%` → `100%`).

5. **Fault-Tolerant Redis & Database Fallbacks**:
   - If Redis is unconfigured or offline, all microservices seamlessly fall back to MySQL database state without throwing errors.

6. **Exactly-Once Scheduled Notifications**:
   - Runs an automated cron job every 1 minute (`*/1 * * * *`).
   - Uses DB `UNIQUE` constraints and Redis locks (`SETNX`) to ensure exactly one notification per placed/shipped order.
   - Includes a **"Sync Notifications Now"** button on the UI for 1-click manual execution.

---

## 🛠️ Quick Start (Local Setup)

### Prerequisites
- **Node.js 20+** and **npm**
- **MySQL 8** (or Aiven Cloud MySQL)
- **Redis 7** (Optional)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/deepakdevengineer/Assignment-Order-Processing-System.git
cd Assignment-Order-Processing-System

# Install all microservices & frontend
cd order-service      && npm install && cd ..
cd inventory-service  && npm install && cd ..
cd payment-service    && npm install && cd ..
cd shipping-service   && npm install && cd ..
cd coordinator        && npm install && cd ..
cd notification-service && npm install && cd ..
cd frontend           && npm install && cd ..
```

### 2. Start Services Locally

Start all 7 services in separate terminal windows:

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

Open **`http://localhost:4200`** in your browser.

---

## 🐳 Docker Compose

Run the entire platform with a single command:

```bash
docker-compose up --build
```

---

## 🧪 Testing & Failure Simulation

Run the automated Jest test suite for the Saga Orchestrator:

```bash
cd coordinator
npm test
```

### Simulated Failures in `orders_bulk.csv`:

The CSV supports `fail_at` and `comp_fail_at` test columns:

| `fail_at` Value | Effect | Resulting Status |
| :--- | :--- | :--- |
| `CREATE_ORDER` | Order service fails | `CANCELLED` |
| `RESERVE_INVENTORY` | Inventory service fails | `CANCELLED` |
| `CHARGE_PAYMENT` | Payment service fails | `CANCELLED` |
| `CREATE_SHIPMENT` | Shipping service fails | `CANCELLED` |

| `comp_fail_at` Value | Effect | Resulting Status |
| :--- | :--- | :--- |
| `CANCEL_ORDER` | Order cancellation fails | `NEEDS_ATTENTION` |
| `RELEASE_INVENTORY` | Inventory release fails | `NEEDS_ATTENTION` |
| `REFUND_PAYMENT` | Payment refund fails | `NEEDS_ATTENTION` |
| `CANCEL_SHIPMENT` | Shipment cancellation fails | `NEEDS_ATTENTION` |

---

## 📦 Ports & Services Summary

| Service | Local Port | Environment Variable |
| :--- | :--- | :--- |
| **Coordinator API** | `3000` | `PORT=3000` |
| **Order Service** | `3001` | `PORT=3001` |
| **Inventory Service** | `3002` | `PORT=3002` |
| **Payment Service** | `3003` | `PORT=3003` |
| **Shipping Service** | `3004` | `PORT=3004` |
| **Notification Service** | `3005` | `PORT=3005` |
| **Angular Frontend** | `4200` | `ng serve` |

---

## 📄 License

This project is open-source and available under the MIT License.
