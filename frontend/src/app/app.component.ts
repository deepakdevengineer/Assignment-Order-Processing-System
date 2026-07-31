import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-layout">
      <!-- Sidebar Navigation -->
      <nav class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">
            <span class="material-icons-round">hub</span>
          </div>
          <div class="brand-text">
            <span class="brand-name">AVON</span>
            <span class="brand-sub">Order Processing</span>
          </div>
        </div>

        <div class="nav-section">
          <span class="nav-label">Main</span>
          <a routerLink="/orders" routerLinkActive="active" class="nav-item" id="nav-orders">
            <span class="material-icons-round">receipt_long</span>
            <span>Orders</span>
          </a>
          <a routerLink="/upload" routerLinkActive="active" class="nav-item" id="nav-upload">
            <span class="material-icons-round">cloud_upload</span>
            <span>Upload CSV</span>
          </a>
          <a routerLink="/notifications" routerLinkActive="active" class="nav-item" id="nav-notifications">
            <span class="material-icons-round">notifications</span>
            <span>Notifications</span>
          </a>
        </div>

        <div class="sidebar-footer">
          <div class="system-status">
            <span class="status-dot"></span>
            <span>System Online</span>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    /* --- Sidebar --- */
    .sidebar {
      width: 260px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 100;
      overflow-y: auto;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .brand-icon {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      background: var(--gradient-brand);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px var(--accent-blue-glow);
    }

    .brand-icon .material-icons-round {
      color: #fff;
      font-size: 22px;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-name {
      font-size: 1.125rem;
      font-weight: 800;
      letter-spacing: 2px;
      background: var(--gradient-brand);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .brand-sub {
      font-size: 0.7rem;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }

    .nav-section {
      padding: 20px 12px;
      flex: 1;
    }

    .nav-label {
      display: block;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--text-muted);
      padding: 0 12px;
      margin-bottom: 12px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 16px;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      transition: all var(--transition-fast);
      margin-bottom: 4px;
      text-decoration: none;
    }

    .nav-item:hover {
      background: rgba(59, 130, 246, 0.08);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: rgba(59, 130, 246, 0.12);
      color: var(--accent-blue);
      font-weight: 600;
    }

    .nav-item.active .material-icons-round {
      color: var(--accent-blue);
    }

    .nav-item .material-icons-round {
      font-size: 20px;
      color: var(--text-muted);
      transition: color var(--transition-fast);
    }

    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
    }

    .system-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-green);
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
      animation: pulse-badge 2s ease-in-out infinite;
    }

    /* --- Main Content --- */
    .main-content {
      flex: 1;
      margin-left: 260px;
      padding: 32px 40px;
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }

    @media (max-width: 768px) {
      .sidebar {
        width: 64px;
      }
      .brand-text, .nav-item span:last-child, .nav-label, .system-status span {
        display: none;
      }
      .sidebar-brand {
        justify-content: center;
        padding: 16px;
      }
      .nav-item {
        justify-content: center;
        padding: 12px;
      }
      .main-content {
        margin-left: 64px;
        padding: 20px;
      }
    }
  `]
})
export class AppComponent {}
