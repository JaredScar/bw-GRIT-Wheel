export interface PhotoSummary {
  email: string;
  updatedAt: string;
}

export interface DirectoryEntry {
  email: string;
  name: string;
  hasPhoto: boolean;
  updatedAt: string | null;
}
