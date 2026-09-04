import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccessRole,
  CreateAccessRolePayload,
  UpdateAccessRolePayload,
} from '../models/access-role.model';
import { PermissionDefinition } from '../models/permission';

@Injectable({ providedIn: 'root' })
export class AccessControlService {
  private readonly baseUrl = '/api/access-control';

  constructor(private readonly http: HttpClient) {}

  /** The permissions this build knows about, with labels for the admin UI. */
  listPermissions(): Observable<PermissionDefinition[]> {
    return this.http.get<PermissionDefinition[]>(`${this.baseUrl}/permissions`);
  }

  listRoles(): Observable<AccessRole[]> {
    return this.http.get<AccessRole[]>(`${this.baseUrl}/roles`);
  }

  createRole(payload: CreateAccessRolePayload): Observable<AccessRole> {
    return this.http.post<AccessRole>(`${this.baseUrl}/roles`, payload);
  }

  updateRole(id: string, payload: UpdateAccessRolePayload): Observable<AccessRole> {
    return this.http.patch<AccessRole>(`${this.baseUrl}/roles/${id}`, payload);
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/roles/${id}`);
  }
}
