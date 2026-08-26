export enum RoundStatus {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum WheelMode {
  EQUAL = 'EQUAL',
  WEIGHTED = 'WEIGHTED',
}

export interface Round {
  id: string;
  title: string;
  eventDate: string | null;
  status: RoundStatus;
  winnerNominationId: string | null;
  winnerNomineeName: string | null;
  wheelMode: WheelMode | null;
  spunAt: string | null;
  createdAt: string;
}

export interface WheelEntry {
  nomineeName: string;
  nominationIds: string[];
}

export interface SpinResult {
  round: Round;
  entries: WheelEntry[];
  winner: WheelEntry;
}
