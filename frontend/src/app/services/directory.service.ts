import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DirectoryImportSummary, DirectoryPerson } from '../models/directory-person.model';

@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly baseUrl = '/api/directory';

  constructor(private readonly http: HttpClient) {}

  listAll(): Observable<DirectoryPerson[]> {
    return this.http.get<DirectoryPerson[]>(this.baseUrl);
  }

  importCsv(csv: string): Observable<DirectoryImportSummary> {
    return this.http.post<DirectoryImportSummary>(`${this.baseUrl}/import`, { csv });
  }
}
