import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DirectoryEntry, PhotoSummary } from '../models/photo.model';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly baseUrl = '/api/photos';

  constructor(private readonly http: HttpClient) {}

  photoUrl(email: string | null | undefined): string | null {
    if (!email) return null;
    return `${this.baseUrl}/${encodeURIComponent(email.trim().toLowerCase())}`;
  }

  getDirectory(): Observable<DirectoryEntry[]> {
    return this.http.get<DirectoryEntry[]>(`${this.baseUrl}/directory`);
  }

  upload(email: string, file: File): Observable<PhotoSummary> {
    const formData = new FormData();
    formData.append('email', email.trim().toLowerCase());
    formData.append('file', file);
    return this.http.post<PhotoSummary>(this.baseUrl, formData);
  }

  remove(email: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.baseUrl}/${encodeURIComponent(email.trim().toLowerCase())}`,
    );
  }
}
