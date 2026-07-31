export interface Order {
  order_id: string;
  sku: string;
  qty: number;
  amount: number;
  status: 'IN_PROGRESS' | 'PLACED' | 'SHIPPED' | 'CANCELLED' | 'NEEDS_ATTENTION';
  fail_at: string | null;
  comp_fail_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStep {
  id: number;
  order_id: string;
  step_name: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  response_data: string | null;
  error_message: string | null;
  started_at: string;
  updated_at: string | null;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderDetailResponse {
  order: Order;
  steps: OrderStep[];
}

export interface UploadResponse {
  message: string;
  totalQueued: number;
  skipped: number;
}

export interface Notification {
  id: number;
  order_id: string;
  sent_at: string;
}
