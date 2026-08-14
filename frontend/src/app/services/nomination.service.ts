import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GritCategory } from '../models/grit-category';
import {
  CreateNominationPayload,
  Nomination,
  NominationSort,
  ToggleUpvoteResult,
} from '../models/nomination.model';

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
      sort?: NominationSort;
    } = {},
  ): Observable<Nomination[]> {
    let params = new HttpParams();
    if (filters.roundId) params = params.set('roundId', filters.roundId);
    if (filters.gritCategory) params = params.set('gritCategory', filters.gritCategory);
    if (filters.sort) params = params.set('sort', filters.sort);
    return this.http.get<Nomination[]>(this.baseUrl, { params });
  }

  toggleUpvote(nominationId: string): Observable<ToggleUpvoteResult> {
    return this.http.post<ToggleUpvoteResult>(`${this.baseUrl}/${nominationId}/upvote`, {});
  }
}
