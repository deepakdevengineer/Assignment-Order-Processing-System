import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../services/order.service';
import { Notification } from '../../models/order.model';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page animate-fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">Notifications</h1>
          <p class="page-subtitle">Shipping notifications sent to customers</p>
        </div>
        <button class="btn btn-outline btn-sm" (click)="loadNotifications()" id="btn-refresh-notifications">
          <span class="material-icons-round">refresh</span>
          Refresh
        </button>
      </div>

      <!-- Info Banner -->
      <div class="info-banner">
        <span class="material-icons-round">info</span>
        <span>The notification service runs every <strong>15 minutes</strong> and sends exactly one notification per shipped order.</span>
      </div>

      <!-- Stats -->
      <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); max-width: 500px;">
        <div class="stat-card">
          <div class="stat-label">Total Sent</div>
          <div class="stat-value">{{ notifications.length }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Service Status</div>
          <div class="stat-value" style="font-size: 1rem; background: linear-gradient(135deg, #10b981, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            <span class="material-icons-round" style="font-size: 14px; color: var(--accent-green); -webkit-text-fill-color: var(--accent-green);">●</span>
            Active
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner"></div>
        <span>Loading notifications...</span>
      </div>

      <!-- Notifications Table -->
      <div class="table-wrapper" *ngIf="!loading && notifications.length > 0">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order ID</th>
              <th>Notification Sent At</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let notif of notifications; let i = index"
                class="animate-fade-in"
                [style.animation-delay]="(i * 0.03) + 's'">
              <td class="index-cell">{{ notif.id }}</td>
              <td>
                <span class="order-id-mono">{{ notif.order_id }}</span>
              </td>
              <td>{{ notif.sent_at | date:'medium' }}</td>
              <td>
                <span class="badge badge-placed">
                  <span class="material-icons-round" style="font-size:14px">check_circle</span>
                  Sent
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && notifications.length === 0">
        <span class="material-icons-round empty-icon">notifications_off</span>
        <h3>No notifications yet</h3>
        <p>Notifications will appear here once shipped orders are processed by the notification service.</p>
      </div>
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

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      background: rgba(59, 130, 246, 0.06);
      border: 1px solid rgba(59, 130, 246, 0.15);
      border-radius: var(--radius-md);
      margin-bottom: 24px;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .info-banner .material-icons-round {
      color: var(--accent-blue);
      font-size: 20px;
    }

    .order-id-mono {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--accent-blue);
    }

    .index-cell {
      color: var(--text-muted);
      font-family: var(--font-mono);
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
  `]
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  loading = true;

  constructor(private orderService: OrderService) {}

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.loading = true;
    this.orderService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notifications = [];
      }
    });
  }
}
