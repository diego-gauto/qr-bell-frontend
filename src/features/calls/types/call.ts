export type CallStatus = 'ringing' | 'accepted' | 'missed';

export interface CallHistoryItem {
  id: string;
  homeId: string;
  homeName: string;
  status: CallStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
  missedAt: string | null;
}

