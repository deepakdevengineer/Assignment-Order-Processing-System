import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { Order, OrderStep } from '../../models/order.model';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page animate-fade-in" *ngIf="!loading">
      <!-- Back button -->
      <a routerLink="/orders" class="back-link" id="btn-back-to-orders">
        <span class="material-icons-round">arrow_back</span>
        Back to Orders
      </a>

      <!-- Order Header -->
      <div class="order-header">
        <div class="order-header-left">
          <h1 class="order-title">
            <span class="order-id-label">Order</span>
            {{ order?.order_id }}
          </h1>
          <span class="badge" [ngClass]="getStatusBadgeClass(order?.status || '')">
            <span class="badge-dot"></span>
            {{ formatStatus(order?.status || '') }}
          </span>
        </div>
        <div class="order-header-actions">
          <button class="btn btn-success"
                  *ngIf="order?.status === 'PLACED'"
                  (click)="markShipped()"
                  id="btn-ship-order">
            <span class="material-icons-round">local_shipping</span>
            Mark as Shipped
          </button>
          <button class="btn btn-warning"
                  *ngIf="order?.status === 'NEEDS_ATTENTION'"
                  (click)="retryCompensation()"
                  [disabled]="retrying"
                  id="btn-retry-order">
            <span class="material-icons-round">replay</span>
            {{ retrying ? 'Retrying...' : 'Retry Failed Undo' }}
          </button>
        </div>
      </div>

      <!-- Order Info Cards -->
      <div class="info-grid">
        <div class="info-card">
          <div class="info-icon" style="background: rgba(59, 130, 246, 0.15); color: var(--accent-blue);">
            <span class="material-icons-round">inventory_2</span>
          </div>
          <div class="info-content">
            <span class="info-label">SKU</span>
            <span class="info-value">{{ order?.sku }}</span>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background: rgba(139, 92, 246, 0.15); color: var(--accent-purple);">
            <span class="material-icons-round">tag</span>
          </div>
          <div class="info-content">
            <span class="info-label">Quantity</span>
            <span class="info-value">{{ order?.qty }}</span>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-green);">
            <span class="material-icons-round">payments</span>
          </div>
          <div class="info-content">
            <span class="info-label">Amount</span>
            <span class="info-value">\${{ order?.amount | number:'1.2-2' }}</span>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-amber);">
            <span class="material-icons-round">schedule</span>
          </div>
          <div class="info-content">
            <span class="info-label">Created</span>
            <span class="info-value">{{ order?.created_at | date:'medium' }}</span>
          </div>
        </div>
      </div>

      <!-- Steps Timeline -->
      <div class="section">
        <h2 class="section-title">
          <span class="material-icons-round">timeline</span>
          Processing Steps
        </h2>

        <div class="steps-container" *ngIf="doSteps.length > 0">
          <h3 class="steps-group-title">Execution Steps</h3>
          <div class="timeline">
            <div *ngFor="let step of doSteps; let i = index"
                 class="timeline-item"
                 [ngClass]="step.status.toLowerCase()"
                 [style.animation-delay]="(i * 0.1) + 's'">
              <div class="step-header">
                <span class="step-name">{{ formatStepName(step.step_name) }}</span>
                <span class="badge" [ngClass]="getStepBadgeClass(step.status)">
                  {{ step.status }}
                </span>
              </div>
              <div class="step-meta">
                <span class="step-time">{{ step.started_at | date:'mediumTime' }}</span>
                <span *ngIf="step.updated_at" class="step-duration">
                  → {{ step.updated_at | date:'mediumTime' }}
                </span>
              </div>
              <div *ngIf="step.error_message" class="step-error">
                <span class="material-icons-round" style="font-size:16px">error_outline</span>
                {{ step.error_message }}
              </div>
            </div>
          </div>
        </div>

        <div class="steps-container" *ngIf="undoSteps.length > 0">
          <h3 class="steps-group-title undo-title">
            <span class="material-icons-round" style="font-size:18px">undo</span>
            Compensation Steps (Undo)
          </h3>
          <div class="timeline">
            <div *ngFor="let step of undoSteps; let i = index"
                 class="timeline-item"
                 [ngClass]="step.status.toLowerCase()"
                 [style.animation-delay]="(i * 0.1) + 's'">
              <div class="step-header">
                <span class="step-name">{{ formatStepName(step.step_name) }}</span>
                <span class="badge" [ngClass]="getStepBadgeClass(step.status)">
                  {{ step.status }}
                </span>
              </div>
              <div class="step-meta">
                <span class="step-time">{{ step.started_at | date:'mediumTime' }}</span>
              </div>
              <div *ngIf="step.error_message" class="step-error">
                <span class="material-icons-round" style="font-size:16px">error_outline</span>
                {{ step.error_message }}
              </div>
            </div>
          </div>
        </div>

        <div class="empty-steps" *ngIf="doSteps.length === 0 && undoSteps.length === 0">
          <span class="material-icons-round" style="font-size:48px; opacity:0.3;">pending_actions</span>
          <p>No steps recorded yet</p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div class="loading-overlay" *ngIf="loading">
      <div class="spinner"></div>
      <span>Loading order details...</span>
    </div>

    <!-- Toast -->
    <div *ngIf="toastMessage" class="toast" [ngClass]="'toast-' + toastType">
      {{ toastMessage }}
    </div>
  `,
  styles: [`
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 24px;
      transition: color var(--transition-fast);
    }

    .back-link:hover {
      color: var(--accent-blue);
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .order-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .order-title {
      font-size: 1.75rem;
      font-weight: 800;
    }

    .order-id-label {
      color: var(--text-muted);
      font-weight: 400;
      margin-right: 8px;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }

    .info-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 20px;
      transition: all var(--transition-base);
    }

    .info-card:hover {
      border-color: var(--accent-blue);
      transform: translateY(-2px);
    }

    .info-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .info-content {
      display: flex;
      flex-direction: column;
    }

    .info-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 24px;
      color: var(--text-primary);
    }

    .section-title .material-icons-round {
      color: var(--accent-blue);
    }

    .steps-container {
      margin-bottom: 32px;
    }

    .steps-group-title {
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-light);
    }

    .undo-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--accent-amber);
    }

    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .step-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .step-meta {
      display: flex;
      gap: 12px;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .step-error {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: var(--radius-sm);
      font-size: 0.8125rem;
      color: var(--accent-red);
    }

    .empty-steps {
      text-align: center;
      padding: 48px;
      color: var(--text-muted);
    }

    .order-header-actions {
      display: flex;
      gap: 12px;
    }
  `]
})
export class OrderDetailComponent implements OnInit {
  order: Order | null = null;
  doSteps: OrderStep[] = [];
  undoSteps: OrderStep[] = [];
  loading = true;
  retrying = false;
  toastMessage = '';
  toastType = 'info';

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadOrder(id);
  }

  loadOrder(id: string) {
    this.loading = true;
    this.orderService.getOrderDetail(id).subscribe({
      next: (res) => {
        this.order = res.order;
        // Steps with "UNDO_" prefix are compensation steps
        this.doSteps = res.steps.filter(s => !s.step_name.startsWith('UNDO_'));
        this.undoSteps = res.steps.filter(s => s.step_name.startsWith('UNDO_'));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load order details', 'error');
      }
    });
  }

  markShipped() {
    if (!this.order) return;
    this.orderService.markShipped(this.order.order_id).subscribe({
      next: () => {
        this.order!.status = 'SHIPPED';
        this.showToast('Order marked as shipped!', 'success');
      },
      error: () => this.showToast('Failed to mark as shipped', 'error')
    });
  }

  retryCompensation() {
    if (!this.order) return;
    this.retrying = true;
    this.orderService.retryCompensation(this.order.order_id).subscribe({
      next: (res) => {
        this.retrying = false;
        this.showToast(
          res.success ? 'Retry succeeded! Order cancelled.' : 'Retry failed, still needs attention.',
          res.success ? 'success' : 'error'
        );
        this.loadOrder(this.order!.order_id);
      },
      error: () => {
        this.retrying = false;
        this.showToast('Retry request failed', 'error');
      }
    });
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

  getStepBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'SUCCESS': 'badge-placed',
      'FAILED': 'badge-cancelled',
      'PENDING': 'badge-in-progress'
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

  formatStepName(name: string): string {
    return name.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }

  showToast(message: string, type: string) {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => this.toastMessage = '', 3500);
  }
}
