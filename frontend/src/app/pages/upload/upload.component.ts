import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpEventType } from '@angular/common/http';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page animate-fade-in">
      <div class="page-header">
        <div>
          <h1 class="page-title">Upload Orders</h1>
          <p class="page-subtitle">Import orders from a CSV file for bulk processing</p>
        </div>
      </div>

      <!-- Upload Area -->
      <div class="upload-card card" *ngIf="!uploading && !uploadResult">
        <div class="upload-area"
             [class.dragging]="isDragging"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event)"
             (click)="fileInput.click()"
             id="upload-dropzone">
          <input #fileInput type="file" accept=".csv"
                 (change)="onFileSelected($event)"
                 style="display:none;"
                 id="upload-file-input">
          <div class="upload-icon-wrapper">
            <span class="material-icons-round upload-icon">cloud_upload</span>
          </div>
          <h3 class="upload-title">Drop your CSV file here</h3>
          <p class="upload-subtitle">or click to browse</p>
          <div class="upload-format">
            <span class="material-icons-round" style="font-size:16px">info</span>
            Expected format: order_id, sku, qty, amount, fail_at, comp_fail_at
          </div>
        </div>

        <!-- File selected preview -->
        <div class="file-preview" *ngIf="selectedFile">
          <div class="file-info">
            <span class="material-icons-round file-icon">description</span>
            <div>
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
            </div>
          </div>
          <div class="file-actions">
            <button class="btn btn-outline btn-sm" (click)="clearFile()" id="btn-clear-file">
              <span class="material-icons-round" style="font-size:16px">close</span>
              Remove
            </button>
            <button class="btn btn-primary" (click)="upload()" id="btn-upload">
              <span class="material-icons-round">upload_file</span>
              Process Orders
            </button>
          </div>
        </div>
      </div>

      <!-- Uploading State with Smooth Progress Bar -->
      <div class="upload-card card uploading-state" *ngIf="uploading">
        <div class="upload-progress">
          <div class="progress-circle-wrapper">
            <div class="spinner" style="width:56px; height:56px; border-width:4px;"></div>
            <span class="progress-percentage">{{ uploadProgress }}%</span>
          </div>
          <h3>Uploading & Processing Orders...</h3>
          <p class="progress-subtitle" *ngIf="uploadProgress < 65">
            Uploading CSV file ({{ uploadProgress }}% complete)
          </p>
          <p class="progress-subtitle" *ngIf="uploadProgress >= 65 && uploadProgress < 100">
            Saving orders in Aiven Cloud MySQL & starting Saga Orchestration...
          </p>
          <p class="progress-subtitle" *ngIf="uploadProgress === 100">
            Finalizing order queuing...
          </p>

          <!-- Linear Animated Progress Bar -->
          <div class="progress-bar-container">
            <div class="progress-bar-fill" [style.width.%]="uploadProgress"></div>
          </div>
        </div>
      </div>

      <!-- Upload Result -->
      <div class="upload-card card result-state animate-fade-in" *ngIf="uploadResult">
        <div class="result-icon-wrapper">
          <span class="material-icons-round result-icon">check_circle</span>
        </div>
        <h3 class="result-title">Upload Complete!</h3>
        <div class="result-stats">
          <div class="result-stat">
            <span class="result-stat-value">{{ uploadResult.totalQueued }}</span>
            <span class="result-stat-label">Orders Queued</span>
          </div>
          <div class="result-stat">
            <span class="result-stat-value">{{ uploadResult.skipped }}</span>
            <span class="result-stat-label">Skipped (Duplicates)</span>
          </div>
        </div>
        <div class="result-actions">
          <a routerLink="/orders" class="btn btn-primary" id="btn-view-orders">
            <span class="material-icons-round">receipt_long</span>
            View Orders
          </a>
          <button class="btn btn-outline" (click)="resetUpload()" id="btn-upload-another">
            <span class="material-icons-round">cloud_upload</span>
            Upload Another
          </button>
        </div>
      </div>

      <!-- Error -->
      <div class="upload-card card error-state animate-fade-in" *ngIf="errorMessage">
        <span class="material-icons-round error-icon">error_outline</span>
        <h3>Upload Failed</h3>
        <p>{{ errorMessage }}</p>
        <button class="btn btn-outline" (click)="resetUpload()">Try Again</button>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
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

    .upload-card {
      max-width: 640px;
      margin: 0 auto;
    }

    .upload-icon-wrapper {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .upload-icon {
      font-size: 36px;
      color: var(--accent-blue);
    }

    .upload-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    .upload-subtitle {
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    .upload-format {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(59, 130, 246, 0.06);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .file-preview {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      margin-top: 20px;
      background: var(--bg-input);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .file-icon {
      font-size: 32px;
      color: var(--accent-blue);
    }

    .file-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .file-size {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .file-actions {
      display: flex;
      gap: 8px;
    }

    .uploading-state {
      text-align: center;
      padding: 64px 32px;
    }

    .upload-progress {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      width: 100%;
    }

    .progress-circle-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .progress-percentage {
      position: absolute;
      font-weight: 800;
      font-size: 0.9375rem;
      color: var(--accent-blue);
    }

    .upload-progress h3 {
      font-size: 1.25rem;
      color: var(--text-primary);
    }

    .progress-subtitle {
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .progress-bar-container {
      width: 100%;
      max-width: 400px;
      height: 10px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 8px;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
      border-radius: 999px;
      transition: width 0.3s ease;
    }

    .result-state {
      text-align: center;
      padding: 48px;
    }

    .result-icon-wrapper {
      margin-bottom: 16px;
    }

    .result-icon {
      font-size: 64px;
      color: var(--accent-green);
    }

    .result-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 24px;
    }

    .result-stats {
      display: flex;
      justify-content: center;
      gap: 48px;
      margin-bottom: 32px;
    }

    .result-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .result-stat-value {
      font-size: 2rem;
      font-weight: 800;
      background: var(--gradient-brand);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .result-stat-label {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .result-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .error-state {
      text-align: center;
      padding: 48px;
    }

    .error-icon {
      font-size: 64px;
      color: var(--accent-red);
      margin-bottom: 16px;
    }

    .error-state h3 {
      font-size: 1.25rem;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .error-state p {
      color: var(--text-muted);
      margin-bottom: 24px;
    }
  `]
})
export class UploadComponent {
  selectedFile: File | null = null;
  uploading = false;
  uploadProgress = 0;
  uploadResult: any = null;
  errorMessage = '';
  isDragging = false;

  constructor(private orderService: OrderService) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  clearFile() {
    this.selectedFile = null;
  }

  upload() {
    if (!this.selectedFile) return;
    this.uploading = true;
    this.uploadProgress = 0;
    this.errorMessage = '';

    // Smooth visual progress increments while uploading & processing
    const progressTimer = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.floor(Math.random() * 12) + 6;
        if (this.uploadProgress > 90) this.uploadProgress = 90;
      }
    }, 120);

    this.orderService.uploadCsv(this.selectedFile).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const raw = Math.round((90 * event.loaded) / event.total);
          if (raw > this.uploadProgress) this.uploadProgress = raw;
        } else if (event.type === HttpEventType.Response) {
          clearInterval(progressTimer);
          this.uploadProgress = 100;
          setTimeout(() => {
            this.uploading = false;
            this.uploadResult = event.body;
          }, 450);
        }
      },
      error: (err) => {
        clearInterval(progressTimer);
        this.uploading = false;
        this.errorMessage = err.error?.message || 'Upload failed. Please try again.';
      }
    });
  }

  resetUpload() {
    this.selectedFile = null;
    this.uploadResult = null;
    this.uploadProgress = 0;
    this.errorMessage = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
