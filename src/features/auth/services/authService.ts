import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseConfig } from "../../../config/firebase";

// We need to create a secondary app instance to create a user 
// without logging out the current admin user.
export const createAuthUser = async (email: string, password: string) => {
    let secondaryApp;
    try {
        // Create a unique name for the secondary app to avoid conflicts
        const appName = `secondaryApp-${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);

        // Immediately sign out from the secondary app to be safe, 
        // though createUser automatically signs in on that instance.
        await signOut(secondaryAuth);

        return userCredential.user.uid;
    } catch (error: any) {
        console.error("Error creating auth user:", error);
        throw error;
    } finally {
        if (secondaryApp) {
            await deleteApp(secondaryApp);
        }
    }
};
