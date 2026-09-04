import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GritCategory } from '../models/grit-category';
import {
  CreateNominationPayload,
  Nomination,
  ToggleReactionResult,
  UpdateNominationPayload,
} from '../models/nomination.model';
import { ReactionType } from '../models/reaction-type';

@Injectable({ providedIn: 'root' })
export class NominationService {
  private readonly baseUrl = '/api/nominations';

  constructor(private readonly http: HttpClient) {}

  create(payload: CreateNominationPayload): Observable<Nomination> {
    return this.http.post<Nomination>(this.baseUrl, payload);
  }

  findAll(
    filters: {
      roundId?: string;
      gritCategory?: GritCategory;
      nomineeEmail?: string;
      /** Admin-only; the server ignores it for everyone else. */
      includeDeleted?: boolean;
    } = {},
  ): Observable<Nomination[]> {
    let params = new HttpParams();
    if (filters.roundId) params = params.set('roundId', filters.roundId);
    if (filters.gritCategory) params = params.set('gritCategory', filters.gritCategory);
    if (filters.nomineeEmail) params = params.set('nomineeEmail', filters.nomineeEmail);
    if (filters.includeDeleted) params = params.set('includeDeleted', 'true');
    return this.http.get<Nomination[]>(this.baseUrl, { params });
  }

  toggleReaction(nominationId: string, type: ReactionType): Observable<ToggleReactionResult> {
    return this.http.post<ToggleReactionResult>(`${this.baseUrl}/${nominationId}/reactions`, {
      type,
    });
  }

  /** Admin only. */
  update(nominationId: string, payload: UpdateNominationPayload): Observable<Nomination> {
    return this.http.patch<Nomination>(`${this.baseUrl}/${nominationId}`, payload);
  }

  /** Admin only. Soft delete — the nomination can be brought back with {@link restore}. */
  remove(nominationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${nominationId}`);
  }

  /** Admin only. */
  restore(nominationId: string): Observable<Nomination> {
    return this.http.post<Nomination>(`${this.baseUrl}/${nominationId}/restore`, {});
  }
}
