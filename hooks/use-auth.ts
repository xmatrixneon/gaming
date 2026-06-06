"use client";

import { useState, useEffect } from "react";

export interface UserProfile {
  username: string;
  email: string;
  avatar: string;
  balance: number;
  vipLevel: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  isLoading: boolean;
}

// Mock user data for testing
const MOCK_USER: UserProfile = {
  username: "Player_12345",
  email: "player@example.com",
  avatar: "🎮",
  balance: 12458.50,
  vipLevel: "Gold",
};

/**
 * Simple auth state hook
 * In production, this would connect to your authentication system
 * For now, it returns mock data for testing the header
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    // Simulate checking auth state
    // In production, this would check a token or session
    const checkAuth = () => {
      const isAuth = localStorage.getItem("isAuthenticated") === "true";
      setAuthState({
        isAuthenticated: isAuth,
        user: isAuth ? MOCK_USER : null,
        isLoading: false,
      });
    };

    checkAuth();
  }, []);

  const login = () => {
    localStorage.setItem("isAuthenticated", "true");
    setAuthState({
      isAuthenticated: true,
      user: MOCK_USER,
      isLoading: false,
    });
  };

  const logout = () => {
    localStorage.removeItem("isAuthenticated");
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    });
  };

  return {
    ...authState,
    login,
    logout,
  };
}
