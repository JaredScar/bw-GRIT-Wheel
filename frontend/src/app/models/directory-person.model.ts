export interface DirectoryPerson {
  email: string;
  name: string;
}

export interface DirectoryImportSummary {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
}
