import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getOrders(page: number = 1, limit: number = 20, status?: string): Observable<OrdersResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<OrdersResponse>(`${this.apiUrl}/orders`, { params });
  }

  getOrderDetail(id: string): Observable<OrderDetailResponse> {
    return this.http.get<OrderDetailResponse>(`${this.apiUrl}/orders/${id}`);
  }

  uploadCsv(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>(`${this.apiUrl}/orders/upload`, formData);
  }

  markShipped(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/orders/${id}/ship`, {});
  }

  retryCompensation(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/orders/${id}/retry`, {});
  }

  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>('http://localhost:3005/api/notifications');
  }
}
