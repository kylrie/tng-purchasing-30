import { createContext, useContext, useState, useEffect } from 'react';
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [tempFirebaseUser, setTempFirebaseUser] = useState<FirebaseUser | null>(null);
  const navigate = useNavigate();

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
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
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
        navigate('/');
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

  const logout = async () => {
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
  };

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
