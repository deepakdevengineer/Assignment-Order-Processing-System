import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { Order, OrdersResponse } from '../../models/order.model';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page animate-fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">Orders</h1>
          <p class="page-subtitle">Monitor and manage all order processing</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline btn-sm" (click)="loadOrders()" id="btn-refresh">
            <span class="material-icons-round">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card" *ngFor="let stat of stats; let i = index"
             [style.animation-delay]="(i * 0.08) + 's'"
             style="animation: fadeIn 0.4s ease-out both;">
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-value" [style.background]="stat.gradient"
               style="-webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
            {{ stat.value }}
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="filter-group">
          <select class="form-input filter-select" [(ngModel)]="selectedStatus"
                  (change)="onFilterChange()" id="filter-status">
            <option value="">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PLACED">Placed</option>
            <option value="SHIPPED">Shipped</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NEEDS_ATTENTION">Needs Attention</option>
          </select>
        </div>
        <div class="results-count" *ngIf="totalOrders > 0">
          Showing {{ ((currentPage - 1) * pageSize) + 1 }}–{{ Math.min(currentPage * pageSize, totalOrders) }}
          of {{ totalOrders }} orders
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner"></div>
        <span>Loading orders...</span>
      </div>

      <!-- Orders Table -->
      <div class="table-wrapper" *ngIf="!loading && orders.length > 0">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>SKU</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let order of orders; let i = index"
                [style.animation-delay]="(i * 0.03) + 's'"
                class="animate-fade-in table-row-link"
                [id]="'order-row-' + order.order_id">
              <td>
                <a [routerLink]="['/orders', order.order_id]" class="order-id-link">
                  {{ order.order_id }}
                </a>
              </td>
              <td>
                <span class="sku-badge">{{ order.sku }}</span>
              </td>
              <td>{{ order.qty }}</td>
              <td class="amount-cell">\${{ order.amount | number:'1.2-2' }}</td>
              <td>
                <span class="badge" [ngClass]="getStatusBadgeClass(order.status)">
                  <span class="badge-dot"></span>
                  {{ formatStatus(order.status) }}
                </span>
              </td>
              <td class="date-cell">{{ order.created_at | date:'short' }}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-success btn-sm"
                          *ngIf="order.status === 'PLACED'"
                          (click)="markShipped(order, $event)"
                          [id]="'btn-ship-' + order.order_id">
                    <span class="material-icons-round" style="font-size:16px">local_shipping</span>
                    Ship
                  </button>
                  <button class="btn btn-warning btn-sm"
                          *ngIf="order.status === 'NEEDS_ATTENTION'"
                          (click)="retryCompensation(order, $event)"
                          [id]="'btn-retry-' + order.order_id">
                    <span class="material-icons-round" style="font-size:16px">replay</span>
                    Retry
                  </button>
                  <a [routerLink]="['/orders', order.order_id]" class="btn btn-outline btn-sm"
                     [id]="'btn-detail-' + order.order_id">
                    <span class="material-icons-round" style="font-size:16px">visibility</span>
                  </a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && orders.length === 0">
        <span class="material-icons-round empty-icon">inbox</span>
        <h3>No orders found</h3>
        <p>Upload a CSV file to start processing orders</p>
        <a routerLink="/upload" class="btn btn-primary">
          <span class="material-icons-round">cloud_upload</span>
          Upload CSV
        </a>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <button (click)="goToPage(1)" [disabled]="currentPage === 1">
          <span class="material-icons-round" style="font-size:18px">first_page</span>
        </button>
        <button (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 1">
          <span class="material-icons-round" style="font-size:18px">chevron_left</span>
        </button>

        <ng-container *ngFor="let p of getVisiblePages()">
          <button *ngIf="p !== '...'" (click)="goToPage(+p)"
                  [class.active]="currentPage === +p">{{ p }}</button>
          <span *ngIf="p === '...'" class="pagination-ellipsis">…</span>
        </ng-container>

        <button (click)="goToPage(currentPage + 1)" [disabled]="currentPage === totalPages">
          <span class="material-icons-round" style="font-size:18px">chevron_right</span>
        </button>
        <button (click)="goToPage(totalPages)" [disabled]="currentPage === totalPages">
          <span class="material-icons-round" style="font-size:18px">last_page</span>
        </button>
      </div>
    </div>

    <!-- Toast -->
    <div *ngIf="toastMessage" class="toast" [ngClass]="'toast-' + toastType">
      {{ toastMessage }}
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 800;
      background: var(--gradient-brand);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 4px;
    }

    .page-subtitle {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .filters-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 16px;
    }

    .filter-select {
      width: 200px;
    }

    .results-count {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .order-id-link {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 0.8125rem;
      color: var(--accent-blue);
      transition: color var(--transition-fast);
    }

    .order-id-link:hover {
      color: var(--accent-cyan);
    }

    .sku-badge {
      display: inline-block;
      padding: 2px 10px;
      background: rgba(139, 92, 246, 0.1);
      color: var(--accent-purple);
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .amount-cell {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--text-primary);
    }

    .date-cell {
      font-size: 0.8125rem;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .action-buttons {
      display: flex;
      gap: 6px;
    }

    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: var(--text-muted);
    }

    .empty-icon {
      font-size: 64px;
      opacity: 0.3;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      font-size: 1.25rem;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .empty-state p {
      margin-bottom: 24px;
    }

    .pagination-ellipsis {
      padding: 8px 4px;
      color: var(--text-muted);
    }
  `]
})
export class OrdersComponent implements OnInit, OnDestroy {
  Math = Math;
  orders: Order[] = [];
  loading = true;
  currentPage = 1;
  pageSize = 20;
  totalOrders = 0;
  totalPages = 0;
  selectedStatus = '';
  toastMessage = '';
  toastType = 'info';
  private refreshInterval: any;

  stats = [
    { label: 'Total Orders', value: 0, gradient: 'var(--gradient-brand)' },
    { label: 'Placed', value: 0, gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
    { label: 'In Progress', value: 0, gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
    { label: 'Cancelled', value: 0, gradient: 'linear-gradient(135deg, #ef4444, #ec4899)' },
    { label: 'Needs Attention', value: 0, gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' }
  ];

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.loadOrders();
    this.loadStats();
    this.refreshInterval = setInterval(() => {
      this.loadOrders(false);
      this.loadStats();
    }, 10000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  loadOrders(showLoading = true) {
    if (showLoading) this.loading = true;
    this.orderService.getOrders(this.currentPage, this.pageSize, this.selectedStatus || undefined)
      .subscribe({
        next: (res) => {
          this.orders = res.orders;
          this.totalOrders = res.total;
          this.totalPages = res.totalPages;
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load orders', err);
          this.loading = false;
          this.showToast('Failed to load orders', 'error');
        }
      });
  }

  loadStats() {
    this.orderService.getOrders(1, 1).subscribe(r => this.stats[0].value = r.total);
    this.orderService.getOrders(1, 1, 'PLACED').subscribe(r => this.stats[1].value = r.total);
    this.orderService.getOrders(1, 1, 'IN_PROGRESS').subscribe(r => this.stats[2].value = r.total);
    this.orderService.getOrders(1, 1, 'CANCELLED').subscribe(r => this.stats[3].value = r.total);
    this.orderService.getOrders(1, 1, 'NEEDS_ATTENTION').subscribe(r => this.stats[4].value = r.total);
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadOrders();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadOrders();
  }

  getVisiblePages(): (string | number)[] {
    const pages: (string | number)[] = [];
    const total = this.totalPages;
    const curr = this.currentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (curr > 3) pages.push('...');
      for (let i = Math.max(2, curr - 1); i <= Math.min(total - 1, curr + 1); i++) {
        pages.push(i);
      }
      if (curr < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'IN_PROGRESS': 'badge-in-progress',
      'PLACED': 'badge-placed',
      'SHIPPED': 'badge-shipped',
      'CANCELLED': 'badge-cancelled',
      'NEEDS_ATTENTION': 'badge-needs-attention'
    };
    return map[status] || '';
  }

  formatStatus(status: string): string {
    const map: Record<string, string> = {
      'IN_PROGRESS': 'In Progress',
      'PLACED': 'Placed',
      'SHIPPED': 'Shipped',
      'CANCELLED': 'Cancelled',
      'NEEDS_ATTENTION': 'Needs Attention'
    };
    return map[status] || status;
  }

  markShipped(order: Order, event: Event) {
    event.stopPropagation();
    this.orderService.markShipped(order.order_id).subscribe({
      next: () => {
        order.status = 'SHIPPED';
        this.showToast(`Order ${order.order_id} marked as shipped`, 'success');
        this.loadStats();
      },
      error: () => this.showToast('Failed to mark as shipped', 'error')
    });
  }

  retryCompensation(order: Order, event: Event) {
    event.stopPropagation();
    this.orderService.retryCompensation(order.order_id).subscribe({
      next: (res) => {
        this.showToast(`Retry ${res.success ? 'succeeded' : 'failed'} for ${order.order_id}`, res.success ? 'success' : 'error');
        this.loadOrders();
        this.loadStats();
      },
      error: () => this.showToast('Retry failed', 'error')
    });
  }

  showToast(message: string, type: string) {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => this.toastMessage = '', 3500);
  }
}
