export interface RingResponse {
  id: string;
  homeId: string;
  status: 'ringing' | 'accepted' | 'missed';
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
  missedAt: string | null;
}
