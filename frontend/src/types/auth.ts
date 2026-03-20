export interface SessionSnapshot {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface SignupResult {
  user: AuthUser;
}

export interface LoginResult {
  success: boolean;
}
