import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Leaderboard, PersonProfile, PersonSummary } from '../models/person.model';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly baseUrl = '/api/people';

  constructor(private readonly http: HttpClient) {}

  listPeople(): Observable<PersonSummary[]> {
    return this.http.get<PersonSummary[]>(this.baseUrl);
  }

  getProfile(email: string): Observable<PersonProfile> {
    return this.http.get<PersonProfile>(`${this.baseUrl}/${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  getLeaderboard(): Observable<Leaderboard> {
    return this.http.get<Leaderboard>(`${this.baseUrl}/leaderboard`);
  }
}
