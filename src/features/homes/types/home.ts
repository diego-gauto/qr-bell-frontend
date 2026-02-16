export interface Home {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ringUrl: string;
}

export interface CreateHomePayload {
  name: string;
  address?: string;
}
