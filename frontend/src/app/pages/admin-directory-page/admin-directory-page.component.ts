import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { DirectoryImportSummary } from '../../models/directory-person.model';
import { DirectoryService } from '../../services/directory.service';

@Component({
  selector: 'app-admin-directory-page',
  standalone: true,
  templateUrl: './admin-directory-page.component.html',
  styleUrl: './admin-directory-page.component.scss',
})
export class AdminDirectoryPageComponent implements OnInit {
  private readonly directoryService = inject(DirectoryService);

  readonly directoryCount = signal(0);
  readonly selectedCsvFile = signal<File | null>(null);
  readonly importingDirectory = signal(false);
  readonly directoryImportError = signal<string | null>(null);
  readonly directoryImportSummary = signal<DirectoryImportSummary | null>(null);

  ngOnInit(): void {
    this.loadDirectoryCount();
  }

  loadDirectoryCount(): void {
    this.directoryService.listAll().subscribe({
      next: (people) => this.directoryCount.set(people.length),
      error: () => {
        // Non-critical for this card; the import button still works either way.
      },
    });
  }

  onDirectoryFileSelected(files: FileList | null): void {
    this.directoryImportError.set(null);
    this.directoryImportSummary.set(null);
    this.selectedCsvFile.set(files?.[0] ?? null);
  }

  importDirectory(fileInput: HTMLInputElement): void {
    const file = this.selectedCsvFile();
    if (!file || this.importingDirectory()) return;

    this.directoryImportError.set(null);
    this.directoryImportSummary.set(null);
    this.importingDirectory.set(true);

    file
      .text()
      .then((csv) =>
        this.directoryService.importCsv(csv).subscribe({
          next: (summary) => {
            this.importingDirectory.set(false);
            this.directoryImportSummary.set(summary);
            this.selectedCsvFile.set(null);
            fileInput.value = '';
            this.loadDirectoryCount();
          },
          error: (err: HttpErrorResponse) => {
            this.importingDirectory.set(false);
            this.directoryImportError.set(err.error?.message ?? 'Unable to import that CSV file.');
          },
        }),
      )
      .catch(() => {
        this.importingDirectory.set(false);
        this.directoryImportError.set('Unable to read that file.');
      });
  }
}
