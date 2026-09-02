export type UserType = 'VENDEDOR' | 'MONITOR' | 'ADMIN';

export interface SessionUser {
  id: number;
  fullName: string;
  type: UserType;
  permissions: string[];
  nombreJefeVentas?: string | null;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  user: SessionUser;
}
