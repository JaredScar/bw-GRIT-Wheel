import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Team } from '../models/team.model';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private readonly baseUrl = '/api/teams';

  constructor(private readonly http: HttpClient) {}

  listAll(): Observable<Team[]> {
    return this.http.get<Team[]>(this.baseUrl);
  }

  create(name: string, managerEmail?: string): Observable<Team> {
    return this.http.post<Team>(this.baseUrl, { name, managerEmail });
  }

  rename(id: string, name: string): Observable<Team> {
    return this.http.patch<Team>(`${this.baseUrl}/${id}`, { name });
  }

  setManager(id: string, managerEmail: string | null): Observable<Team> {
    return this.http.patch<Team>(`${this.baseUrl}/${id}`, { managerEmail: managerEmail ?? '' });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  setMembers(id: string, emails: string[]): Observable<Team> {
    return this.http.put<Team>(`${this.baseUrl}/${id}/members`, { emails });
  }
}
