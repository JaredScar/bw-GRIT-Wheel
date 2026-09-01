export interface TeamPerson {
  email: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  manager: TeamPerson | null;
  members: TeamPerson[];
  createdAt: string;
}
