import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  AuthState,
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
} from "../types/user";
import { apiClient } from "../api/client";
import { clearMasterKeyCache } from "../crypto/vaultKey";

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<User | null>;
  refreshUser: () => Promise<void>;
  isBootstrapping: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "booster_vault_auth";

const loadStoredTokens = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load stored tokens:", error);
  }
  return null;
};

const saveTokens = (
  tokens: { accessToken: string; refreshToken: string } | null,
) => {
  try {
    if (tokens) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error("Failed to save tokens:", error);
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const didLogMeShapeRef = useRef(false);

  // Function to clear in-memory vault data on logout.
  // Note: wrapped media keys are stored encrypted in IndexedDB; clearing them here would
  // permanently break decryption for already-uploaded media (until a key-sync feature exists).
  const handleHardLogout = useCallback(() => {
    // Clear vault master key
    clearMasterKeyCache();

    // Clear localStorage vault data
    localStorage.removeItem("booster_vault_master_key");
    localStorage.removeItem("booster_vault_encrypted_key_bundle");
    localStorage.removeItem("booster_vault_salt");

    // Clear session storage
    sessionStorage.clear();
  }, []);

  // Initialize from storage and attempt refresh
  useEffect(() => {
    const initializeAuth = async () => {
      const storedTokens = loadStoredTokens();

      if (storedTokens?.accessToken && storedTokens?.refreshToken) {
        // Set tokens in API client
        apiClient.setTokens(storedTokens);

        // Try to refresh user data
        try {
          const user = await fetchCurrentUser();
          setAuthState({
            user,
            accessToken: storedTokens.accessToken,
            refreshToken: storedTokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error("Failed to refresh user data:", error);
          // Clear invalid tokens
          apiClient.setTokens(null);
          saveTokens(null);
          // Clear vault keys on refresh failure
          handleHardLogout();
          setAuthState({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, [handleHardLogout]);

  const fetchCurrentUser = async (): Promise<User> => {
    const raw = await apiClient.get<any>("/v1/me");
    const response: any = raw?.user ?? raw;

    if (import.meta.env.DEV && !didLogMeShapeRef.current) {
      didLogMeShapeRef.current = true;
      console.debug("[Auth] GET /v1/me shape", {
        wrapped: !!raw?.user,
        hasId: !!response?.id,
        hasEmail: !!response?.email,
        emailVerified: response?.emailVerified ?? response?.isEmailVerified,
        hasDisplayName: response?.displayName !== undefined,
        locale: response?.locale,
        timezone: response?.timezone,
      });
    }

    return {
      id: response.id,
      email: response.email,
      displayName: response.displayName,
      locale: response.locale,
      timezone: response.timezone,
      emailVerified: response.emailVerified ?? response.isEmailVerified,
      trialEndsAt: response.trialEndsAt,
      subscriptionStatus: response.subscriptionStatus,
      currentPlanCode: response.currentPlanCode,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  };

  const login = async (credentials: LoginCredentials) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await apiClient.post<AuthResponse>(
        "/v1/auth/login",
        credentials,
      );

      // Update tokens in API client
      const tokens = {
        accessToken: response.session.accessToken,
        refreshToken: response.session.refreshToken,
      };
      apiClient.setTokens(tokens);
      saveTokens(tokens);

      // Fetch user data
      const user = await fetchCurrentUser();

      setAuthState({
        user,
        accessToken: response.session.accessToken,
        refreshToken: response.session.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await apiClient.post<AuthResponse>(
        "/v1/auth/register",
        data,
      );

      const tokens = {
        accessToken: response.session.accessToken,
        refreshToken: response.session.refreshToken,
      };
      apiClient.setTokens(tokens);
      saveTokens(tokens);

      // Fetch user data
      const user = await fetchCurrentUser();

      setAuthState({
        user,
        accessToken: response.session.accessToken,
        refreshToken: response.session.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = useCallback(() => {
    apiClient.setTokens(null);
    saveTokens(null);
    // Clear all vault data
    handleHardLogout();
    setAuthState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, [handleHardLogout]);

  // If the API layer invalidates auth (e.g., refresh token failure), hard-logout immediately.
  useEffect(() => {
    const onInvalidated = (event: Event) => {
      const custom = event as CustomEvent<{ reason?: string }>;
      console.warn("[Auth] Session invalidated", custom.detail);
      logout();
    };

    window.addEventListener("booster-auth-invalidated", onInvalidated);
    return () => {
      window.removeEventListener("booster-auth-invalidated", onInvalidated);
    };
  }, [logout]);

  const refreshMe = async (): Promise<User | null> => {
    if (!authState.isAuthenticated) {
      return null;
    }

    try {
      const user = await fetchCurrentUser();
      setAuthState((prev) => ({
        ...prev,
        user,
      }));
      return user;
    } catch (error: any) {
      console.error("Failed to refresh user:", error);

      const status = error?.status ?? error?.response?.status;
      if (
        status === 401 ||
        status === 403 ||
        (error instanceof Error && error.message.includes("401"))
      ) {
        logout();
      }

      return null;
    }
  };

  const refreshUser = async () => {
    await refreshMe();
  };

  const value: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    refreshMe,
    refreshUser,
    isBootstrapping: authState.isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
