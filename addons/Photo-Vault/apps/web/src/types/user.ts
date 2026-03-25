export interface User {
  id: string;
  email: string;
  displayName?: string;
  locale: string;
  timezone: string;
  emailVerified: boolean;
  trialEndsAt?: string;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  currentPlanCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
  locale?: string;
  timezone?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    isEmailVerified: boolean;
    displayName?: string | null;
    locale: string;
    timezone: string;
    createdAt: string;
    updatedAt: string;
  };
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}
