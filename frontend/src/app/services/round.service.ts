import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Round, SpinResult, WheelEntry } from '../models/round.model';

export interface CreateRoundPayload {
  title: string;
  eventDate?: string;
}

@Injectable({ providedIn: 'root' })
export class RoundService {
  private readonly baseUrl = '/api/rounds';

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<Round[]> {
    return this.http.get<Round[]>(this.baseUrl);
  }

  findOne(id: string): Observable<Round> {
    return this.http.get<Round>(`${this.baseUrl}/${id}`);
  }

  getCurrent(): Observable<Round> {
    return this.http.get<Round>(`${this.baseUrl}/current`);
  }

  getWheelEntries(roundId: string): Observable<WheelEntry[]> {
    return this.http.get<WheelEntry[]>(`${this.baseUrl}/${roundId}/wheel`);
  }

  createRound(payload: CreateRoundPayload): Observable<Round> {
    return this.http.post<Round>(this.baseUrl, payload);
  }

  spin(roundId: string, weighted = false): Observable<SpinResult> {
    return this.http.post<SpinResult>(`${this.baseUrl}/${roundId}/spin`, { weighted });
  }
}
