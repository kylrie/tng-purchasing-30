import { createContext } from 'react';
import type { UserRole } from '../shared/types/firebase.types';

export interface AuthContextType {
  currentUser: import('../shared/types/firebase.types').User | null;
  loading: boolean;
  error: string | null;
  isNewUser: boolean;
  setError: (error: string | null) => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeNewUserRegistration: (role: UserRole, businessId: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
