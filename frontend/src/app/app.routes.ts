import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/orders', pathMatch: 'full' },
  {
    path: 'orders',
    loadComponent: () =>
      import('./pages/orders/orders.component').then(m => m.OrdersComponent)
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('./pages/order-detail/order-detail.component').then(m => m.OrderDetailComponent)
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./pages/upload/upload.component').then(m => m.UploadComponent)
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent)
  }
];
