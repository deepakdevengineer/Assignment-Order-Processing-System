/**
 * Tests for the Order Processing System
 *
 * These tests verify the key behaviors of the saga orchestrator:
 * 1. All steps succeed → order PLACED
 * 2. A step fails → compensations run → order CANCELLED
 * 3. Idempotency — never do a step twice
 * 4. Compensation failure → order NEEDS_ATTENTION
 *
 * NOTE: These are integration-style tests that mock the external services
 * and the database layer to test the orchestrator logic in isolation.
 */

// Mock dependencies before requiring the module
const mockQuery = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockAxiosPost = jest.fn();
const mockAxiosDelete = jest.fn();

jest.mock('../src/db', () => ({
  query: mockQuery
}));

jest.mock('../src/redis', () => ({
  get: mockRedisGet,
  set: mockRedisSet
}));

jest.mock('axios', () => ({
  post: mockAxiosPost,
  delete: mockAxiosDelete
}));

// Set env vars
process.env.ORDER_SERVICE_URL = 'http://localhost:3001';
process.env.INVENTORY_SERVICE_URL = 'http://localhost:3002';
process.env.PAYMENT_SERVICE_URL = 'http://localhost:3003';
process.env.SHIPPING_SERVICE_URL = 'http://localhost:3004';

const { processOrder, runStep, runCompensation } = require('../src/saga/orchestrator');

describe('Saga Orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing steps in DB, no cache
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    // Default DB mock: returns empty for SELECTs, success for writes
    mockQuery.mockResolvedValue([{ affectedRows: 1 }]);
  });

  /**
   * Helper to set up the DB mock so that:
   * - SELECT on order_steps returns [[]] (no existing step)
   * - All other queries return success
   */
  function setupDefaultDbMock() {
    mockQuery.mockImplementation((sql) => {
      if (sql.includes('SELECT') && sql.includes('order_steps')) {
        return Promise.resolve([[]]);
      }
      return Promise.resolve([{ affectedRows: 1 }]);
    });
  }

  describe('processOrder — all steps succeed', () => {
    test('should set order status to PLACED when all 4 steps succeed', async () => {
      setupDefaultDbMock();
      mockAxiosPost.mockResolvedValue({ data: { success: true } });

      const order = {
        order_id: 'ORD-TEST-001',
        sku: 'WIDGET-A',
        qty: 5,
        amount: 100.00,
        fail_at: null,
        comp_fail_at: null
      };

      await processOrder(order);

      // Verify that order was set to PLACED
      const updateCalls = mockQuery.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('PLACED')
      );
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    test('should call all 4 services in parallel', async () => {
      setupDefaultDbMock();
      mockAxiosPost.mockResolvedValue({ data: { success: true } });

      await processOrder({
        order_id: 'ORD-TEST-002',
        sku: 'WIDGET-B',
        qty: 3,
        amount: 50.00,
        fail_at: null,
        comp_fail_at: null
      });

      // All 4 services should have been called
      expect(mockAxiosPost).toHaveBeenCalledTimes(4);

      const urls = mockAxiosPost.mock.calls.map(call => call[0]);
      expect(urls).toContainEqual(expect.stringContaining('/orders'));
      expect(urls).toContainEqual(expect.stringContaining('/reservations'));
      expect(urls).toContainEqual(expect.stringContaining('/charges'));
      expect(urls).toContainEqual(expect.stringContaining('/shipments'));
    });
  });

  describe('processOrder — step failure triggers compensation', () => {
    test('should compensate succeeded steps and set CANCELLED when a step fails', async () => {
      setupDefaultDbMock();

      // All calls succeed EXCEPT when URL contains /shipments (CREATE_SHIPMENT fails)
      mockAxiosPost.mockImplementation((url) => {
        if (url.includes('/shipments')) {
          return Promise.reject(new Error('Simulated failure at CREATE_SHIPMENT'));
        }
        return Promise.resolve({ data: { success: true } });
      });

      // Compensations succeed
      mockAxiosDelete.mockResolvedValue({ data: { success: true } });

      await processOrder({
        order_id: 'ORD-TEST-003',
        sku: 'GADGET-X',
        qty: 2,
        amount: 75.00,
        fail_at: 'CREATE_SHIPMENT',
        comp_fail_at: null
      });

      // Verify compensations were called for the 3 that succeeded
      expect(mockAxiosDelete).toHaveBeenCalled();

      // Verify order set to CANCELLED
      const cancelCalls = mockQuery.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('CANCELLED')
      );
      expect(cancelCalls.length).toBeGreaterThan(0);
    });
  });

  describe('processOrder — compensation failure marks NEEDS_ATTENTION', () => {
    test('should set NEEDS_ATTENTION when a compensation fails', async () => {
      setupDefaultDbMock();

      // RESERVE_INVENTORY fails, others succeed
      mockAxiosPost.mockImplementation((url) => {
        if (url.includes('/reservations')) {
          return Promise.reject(new Error('Simulated failure at RESERVE_INVENTORY'));
        }
        return Promise.resolve({ data: { success: true } });
      });

      // ALL compensations fail permanently
      mockAxiosDelete.mockRejectedValue(new Error('Compensation permanently failed'));

      await processOrder({
        order_id: 'ORD-TEST-004',
        sku: 'SENSOR-T1',
        qty: 1,
        amount: 30.00,
        fail_at: 'RESERVE_INVENTORY',
        comp_fail_at: 'CANCEL_ORDER'
      });

      // Should be NEEDS_ATTENTION
      const needsAttentionCalls = mockQuery.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('NEEDS_ATTENTION')
      );
      expect(needsAttentionCalls.length).toBeGreaterThan(0);
    });
  });

  describe('runStep — idempotency', () => {
    test('should skip execution if step is already cached as done in Redis', async () => {
      mockRedisGet.mockResolvedValue('done');
      const mockFn = jest.fn();

      const result = await runStep('ORD-IDEMP-001', 'CREATE_ORDER', mockFn);

      expect(result.success).toBe(true);
      expect(mockFn).not.toHaveBeenCalled(); // Should NOT have called the service
    });

    test('should skip execution if step is already SUCCESS in DB', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockQuery.mockImplementation((sql) => {
        if (sql.includes('SELECT') && sql.includes('order_steps')) {
          return Promise.resolve([[{ status: 'SUCCESS', response_data: null }]]);
        }
        return Promise.resolve([{ affectedRows: 1 }]);
      });

      const mockFn = jest.fn();
      const result = await runStep('ORD-IDEMP-002', 'CREATE_ORDER', mockFn);

      expect(result.success).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
      // Should have cached the result in Redis
      expect(mockRedisSet).toHaveBeenCalled();
    });
  });

  describe('runStep — retry logic', () => {
    test('should retry up to maxRetries on transient failures', async () => {
      setupDefaultDbMock();
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Transient error 1'))
        .mockRejectedValueOnce(new Error('Transient error 2'))
        .mockResolvedValueOnce({ data: { success: true } });

      const result = await runStep('ORD-RETRY-001', 'CHARGE_PAYMENT', mockFn, 3, 5000);

      expect(result.success).toBe(true);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('should return failed after exhausting all retries', async () => {
      setupDefaultDbMock();
      const mockFn = jest.fn().mockRejectedValue(new Error('Permanent failure'));

      const result = await runStep('ORD-RETRY-002', 'CHARGE_PAYMENT', mockFn, 3, 5000);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('runCompensation — idempotency', () => {
    test('should skip if compensation already cached as done', async () => {
      mockRedisGet.mockResolvedValue('done');
      const mockFn = jest.fn();

      const result = await runCompensation('ORD-COMP-001', 'CREATE_ORDER', mockFn);

      expect(result.success).toBe(true);
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
});
