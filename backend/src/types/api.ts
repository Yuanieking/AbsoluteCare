export interface AuthUser {
  userId: string;
  role?: string;
  sub?: string;
  [claim: string]: unknown;
}
