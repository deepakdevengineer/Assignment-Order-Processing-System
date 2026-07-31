-- ============================================================
-- Order Processing System — Database Schema
-- ============================================================

-- 1. Coordinator DB
CREATE DATABASE IF NOT EXISTS coordinator_db;
USE coordinator_db;

CREATE TABLE IF NOT EXISTS orders (
    order_id        VARCHAR(20)     PRIMARY KEY,
    sku             VARCHAR(50)     NOT NULL,
    qty             INT             NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    status          ENUM('IN_PROGRESS','PLACED','SHIPPED','CANCELLED','NEEDS_ATTENTION')
                                    NOT NULL DEFAULT 'IN_PROGRESS',
    fail_at         VARCHAR(50)     DEFAULT NULL,
    comp_fail_at    VARCHAR(50)     DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_steps (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    order_id        VARCHAR(20)     NOT NULL,
    step_name       VARCHAR(50)     NOT NULL,
    status          ENUM('PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'PENDING',
    response_data   TEXT            DEFAULT NULL,
    error_message   TEXT            DEFAULT NULL,
    started_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_order_step (order_id, step_name),
    INDEX idx_order_id (order_id),
    CONSTRAINT fk_os_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB;

-- 2. Order Service DB
CREATE DATABASE IF NOT EXISTS order_db;
USE order_db;

CREATE TABLE IF NOT EXISTS orders (
    order_id        VARCHAR(20)     PRIMARY KEY,
    sku             VARCHAR(50)     NOT NULL,
    qty             INT             NOT NULL,
    amount          DECIMAL(12,2)   NOT NULL,
    status          ENUM('CREATED','CANCELLED') NOT NULL DEFAULT 'CREATED',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Inventory Service DB
CREATE DATABASE IF NOT EXISTS inventory_db;
USE inventory_db;

CREATE TABLE IF NOT EXISTS inventory (
    sku             VARCHAR(50)     PRIMARY KEY,
    available_qty   INT             NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
    order_id        VARCHAR(20)     PRIMARY KEY,
    sku             VARCHAR(50)     NOT NULL,
    qty             INT             NOT NULL,
    status          ENUM('RESERVED','RELEASED') NOT NULL DEFAULT 'RESERVED',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Seed inventory
INSERT INTO inventory (sku, available_qty) VALUES
    ('WIDGET-A',    50000),
    ('WIDGET-B',    50000),
    ('GADGET-X',    50000),
    ('GIZMO-PRO',   50000),
    ('SENSOR-T1',   50000),
    ('MODULE-Z',    50000),
    ('CABLE-2M',    50000),
    ('ADAPTER-USB-C',50000),
    ('BATTERY-AA',  50000),
    ('PANEL-40W',   50000)
ON DUPLICATE KEY UPDATE available_qty = VALUES(available_qty);

-- 4. Payment Service DB
CREATE DATABASE IF NOT EXISTS payment_db;
USE payment_db;

CREATE TABLE IF NOT EXISTS charges (
    order_id        VARCHAR(20)     PRIMARY KEY,
    amount          DECIMAL(12,2)   NOT NULL,
    status          ENUM('CHARGED','REFUNDED') NOT NULL DEFAULT 'CHARGED',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Shipping Service DB
CREATE DATABASE IF NOT EXISTS shipping_db;
USE shipping_db;

CREATE TABLE IF NOT EXISTS shipments (
    order_id        VARCHAR(20)     PRIMARY KEY,
    sku             VARCHAR(50)     NOT NULL,
    qty             INT             NOT NULL,
    status          ENUM('CREATED','CANCELLED') NOT NULL DEFAULT 'CREATED',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. Notification Service DB
CREATE DATABASE IF NOT EXISTS notification_db;
USE notification_db;

CREATE TABLE IF NOT EXISTS notifications (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    order_id        VARCHAR(20)     NOT NULL UNIQUE,
    sent_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
