import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Order,
  OrdersResponse,
  OrderDetailResponse,
  UploadResponse,
  Notification
} from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private get baseUrl(): string {
    if (typeof window !== 'undefined') {
      const customApi = localStorage.getItem('API_URL');
      if (customApi) return customApi;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
      }
    }
    // Deployed Coordinator API Endpoint on Render
    return 'https://order-coordinator.onrender.com/api';
  }

  private get notificationUrl(): string {
    if (typeof window !== 'undefined') {
      const customNotifApi = localStorage.getItem('NOTIFICATION_API_URL');
      if (customNotifApi) return customNotifApi;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3005/api';
      }
    }
    // Deployed Notification Service Endpoint on Render
    return 'https://notification-service-t39v.onrender.com/api';
  }

  constructor(private http: HttpClient) {}

  getOrders(page: number = 1, limit: number = 20, status?: string): Observable<OrdersResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<OrdersResponse>(`${this.baseUrl}/orders`, { params });
  }

  getOrderDetail(id: string): Observable<OrderDetailResponse> {
    return this.http.get<OrderDetailResponse>(`${this.baseUrl}/orders/${id}`);
  }

  uploadCsv(file: File): Observable<HttpEvent<UploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.baseUrl}/orders/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  markShipped(id: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/orders/${id}/ship`, {});
  }

  retryCompensation(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${id}/retry`, {});
  }

  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.notificationUrl}/notifications`);
  }

  triggerNotifications(): Observable<any> {
    return this.http.post(`${this.notificationUrl}/notifications/trigger`, {});
  }
}
