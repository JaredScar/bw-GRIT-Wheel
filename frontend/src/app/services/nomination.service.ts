import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GritCategory } from '../models/grit-category';
import {
  CreateNominationPayload,
  Nomination,
  ToggleReactionResult,
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
    } = {},
  ): Observable<Nomination[]> {
    let params = new HttpParams();
    if (filters.roundId) params = params.set('roundId', filters.roundId);
    if (filters.gritCategory) params = params.set('gritCategory', filters.gritCategory);
    if (filters.nomineeEmail) params = params.set('nomineeEmail', filters.nomineeEmail);
    return this.http.get<Nomination[]>(this.baseUrl, { params });
  }

  toggleReaction(nominationId: string, type: ReactionType): Observable<ToggleReactionResult> {
    return this.http.post<ToggleReactionResult>(`${this.baseUrl}/${nominationId}/reactions`, {
      type,
    });
  }
}
