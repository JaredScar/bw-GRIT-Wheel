import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ManagedUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly baseUrl = '/api/users';

  constructor(private readonly http: HttpClient) {}

  listAll(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(this.baseUrl);
  }

  create(email: string, name?: string): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(this.baseUrl, { email, name });
  }

  rename(id: string, name: string): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(`${this.baseUrl}/${id}`, { name });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
