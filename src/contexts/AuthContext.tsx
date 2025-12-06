import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, updatePassword } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import type { User } from '../shared/types/firebase.types';
import { UserRole, UserStatus } from '../shared/types/firebase.types';
import { COLLECTIONS } from '../shared/types/firebase.types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  isNewUser: boolean;
  setError: (error: string | null) => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeNewUserRegistration: (role: UserRole, businessId: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// =====================================================
// FIX BUG 4: Rate Limiting Storage Keys
// Using localStorage to persist lockout state across page refreshes
// =====================================================
const LOCKOUT_STORAGE_KEY = 'auth_lockout_until';
const ATTEMPTS_STORAGE_KEY = 'auth_login_attempts';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [tempFirebaseUser, setTempFirebaseUser] = useState<FirebaseUser | null>(null);
  const navigate = useNavigate();

  // =====================================================
  // FIX BUG 4: Rate limiting with localStorage persistence
  // State initializes from localStorage to survive page refreshes
  // =====================================================
  const [loginAttempts, setLoginAttempts] = useState<number>(() => {
    const stored = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const stored = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (stored) {
      const lockoutTime = parseInt(stored, 10);
      // Clear if expired
      if (Date.now() >= lockoutTime) {
        localStorage.removeItem(LOCKOUT_STORAGE_KEY);
        localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
        return null;
      }
      return lockoutTime;
    }
    return null;
  });
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 60000; // 1 minute lockout

  // FIX BUG 4: Sync state to localStorage whenever it changes
  useEffect(() => {
    if (lockoutUntil !== null) {
      localStorage.setItem(LOCKOUT_STORAGE_KEY, lockoutUntil.toString());
    } else {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    }
  }, [lockoutUntil]);

  useEffect(() => {
    localStorage.setItem(ATTEMPTS_STORAGE_KEY, loginAttempts.toString());
  }, [loginAttempts]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          if (userData.status === UserStatus.PENDING_APPROVAL) {
            setError('Your account is awaiting approval from an administrator.');
            await signOut(auth);
            setCurrentUser(null);
          } else {
            setCurrentUser({ ...userData, id: userDoc.id });
          }
        } else if (!isNewUser) {
          setTempFirebaseUser(firebaseUser);
          setIsNewUser(true);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isNewUser]);

  const loginWithEmail = async (email: string, pass: string) => {
    // FIX BUG 4: Check lockout from state (which initializes from localStorage)
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const secondsRemaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`Too many failed attempts. Please try again in ${secondsRemaining} seconds.`);
      return;
    }

    // FIX BUG 4: Clear lockout if it has expired
    if (lockoutUntil && Date.now() >= lockoutUntil) {
      setLockoutUntil(null);
      setLoginAttempts(0);
    }

    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // FIX BUG 4: Reset attempts on successful login (also clears localStorage via useEffect)
      setLoginAttempts(0);
      setLockoutUntil(null);
      navigate('/');
    } catch (err: any) {
      // FIX BUG 4: Increment failed attempts (persisted via useEffect)
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const newLockoutTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockoutUntil(newLockoutTime);
        setError(`Too many failed attempts. Account locked for 1 minute.`);
      } else {
        const attemptsRemaining = MAX_LOGIN_ATTEMPTS - newAttempts;
        setError(`${err.message} (${attemptsRemaining} attempts remaining)`);
      }
    } finally {
      setLoading(false);
    }
  };


  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setTempFirebaseUser(firebaseUser);
        setIsNewUser(true);
      } else {
        // FIX C3: Check user status before allowing access (was bypassing status check)
        const userData = userDoc.data() as User;
        if (userData.status === UserStatus.ACTIVE) {
          navigate('/');
        } else if (userData.status === UserStatus.PENDING_APPROVAL) {
          setError('Your account is awaiting approval from an administrator.');
          await signOut(auth);
        } else {
          // Handles REJECTED, INACTIVE, or unknown status
          setError('Your account is not active. Please contact an administrator.');
          await signOut(auth);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeNewUserRegistration = async (role: UserRole, businessId: string, password?: string) => {
    if (!tempFirebaseUser) {
      setError("No temporary user data found to complete registration.");
      return;
    }
    setLoading(true);
    try {
      if (password) {
        await updatePassword(tempFirebaseUser, password);
      }

      const userDocRef = doc(db, COLLECTIONS.USERS, tempFirebaseUser.uid);
      const newUser: Omit<User, 'id'> = {
        name: tempFirebaseUser.displayName || 'Google User',
        email: tempFirebaseUser.email!,
        role: role,
        businessId: businessId,
        avatar: tempFirebaseUser.photoURL || '',
        status: UserStatus.PENDING_APPROVAL,
        isPasswordSet: !!password,
      };
      await setDoc(userDocRef, newUser as User);

      await signOut(auth);
      setIsNewUser(false);
      setTempFirebaseUser(null);
      setError("Registration complete. Your account is now pending admin approval.");
      navigate('/login');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FIX BUG 11: Wrap logout in useCallback to prevent stale closures
  // and satisfy useEffect dependency requirements
  // =====================================================
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsNewUser(false);
      setTempFirebaseUser(null);
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // =====================================================
  // FIX M7: Session Timeout - Auto-logout after 30 min inactivity
  // FIX BUG 11: Added logout to dependency array
  // =====================================================
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  useEffect(() => {
    if (!currentUser) return; // Only track when user is logged in

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        console.log('⏰ Session expired due to inactivity');
        await logout();
      }, SESSION_TIMEOUT_MS);
    };

    // Activity events that reset the timer
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    // Add listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [currentUser, logout]); // FIX BUG 11: Added logout dependency

  const value = {
    currentUser,
    loading,
    error,
    isNewUser,
    setError,
    loginWithEmail,
    loginWithGoogle,
    completeNewUserRegistration,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
