// File: auth.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    updateDoc, // New: Update existing documents
    arrayUnion, // New: Add elements to an array
    arrayRemove, // New: Remove elements from an array
    increment // New: Increment a number
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCfxO30dG_Tdgloom7bq0RSdTfymsi-iCc",
    authDomain: "kg-stevens-eod.firebaseapp.com",
    projectId: "kg-stevens-eod",
    storageBucket: "kg-stevens-eod.firebasestorage.app",
    messagingSenderId: "600225486867",
    appId: "1:600225486867:web:b9b567559017be3d4c47e6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

/**
 * Registers a new user with email and password.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<UserCredential>} A promise that resolves with user credentials.
 */
export async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("User registered:", userCredential.user);
        return userCredential;
    } catch (error) {
        console.error("Error registering user:", error.message);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Updates the user's profile with a display name.
 * @param {object} user - The user object from Firebase Auth.
 * @param {string} displayName - The display name to set.
 * @returns {Promise<void>} A promise that resolves when the profile is updated.
 */
export async function updateUserProfile(user, displayName) {
    try {
        await updateProfile(user, {
            displayName: displayName
        });
        console.log("User profile updated successfully.");
    } catch (error) {
        console.error("Error updating user profile:", error.message);
        throw error;
    }
}

/**
 * Saves additional user details and initializes performance summary to Firestore.
 * @param {string} userId - The UID of the user.
 * @param {object} details - An object containing name, client, and position.
 * @returns {Promise<void>} A promise that resolves when data is saved.
 */
export async function saveUserDetailsToFirestore(userId, details) {
    try {
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, {
            ...details,
            performanceSummary: {
                done: 0,
                wip: 0,
                'not-started': 0,
                cancelled: 0,
            }
        });
        console.log("User details and performance summary saved to Firestore for user:", userId);
    } catch (error) {
        console.error("Error saving user details to Firestore:", error.message);
        throw error;
    }
}

/**
 * Retrieves all user data including details and performance summary.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<object|null>} A promise that resolves with the user's data or null if not found.
 */
export async function getAllUserDataFromFirestore(userId) {
    try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            console.log("User data fetched from Firestore:", userDocSnap.data());
            return userDocSnap.data();
        } else {
            console.log("No user data found in Firestore for user:", userId);
            return null;
        }
    } catch (error) {
        console.error("Error fetching user data from Firestore:", error.message);
        throw error;
    }
}

/**
 * Retrieves daily activities for a specific date.
 * @param {string} userId - The UID of the user.
 * @param {string} dateString - The date in YYYY-MM-DD format.
 * @returns {Promise<object|null>} A promise that resolves with the daily report or null if not found.
 */
export async function getDailyActivities(userId, dateString) {
    try {
        const dailyReportRef = doc(db, "users", userId, "dailyActivities", dateString);
        const dailyReportSnap = await getDoc(dailyReportRef);
        return dailyReportSnap.exists() ? dailyReportSnap.data() : null;
    } catch (error) {
        console.error("Error fetching daily activities:", error.message);
        throw error;
    }
}

/**
 * Adds a new activity to a user's daily report and updates performance summaries.
 * @param {string} userId - The UID of the user.
 * @param {string} dateString - The date in YYYY-MM-DD format.
 * @param {object} newActivity - The new activity object to add.
 * @param {string} status - The status of the new activity ('done', 'wip', etc.).
 * @returns {Promise<void>}
 */
export async function addActivityToDailyReport(userId, dateString, newActivity, status) {
    try {
        const userDocRef = doc(db, "users", userId);
        const dailyReportRef = doc(db, "users", userId, "dailyActivities", dateString);

        // Update the daily activities document
        await setDoc(dailyReportRef, {
            activities: arrayUnion(newActivity),
            [status]: increment(1),
        }, { merge: true }); // Use merge to avoid overwriting the whole document

        // Update the overall performance summary
        await updateDoc(userDocRef, {
            [`performanceSummary.${status}`]: increment(1)
        });

        console.log("Activity added to daily report and performance updated.");
    } catch (error) {
        console.error("Error adding activity:", error.message);
        throw error;
    }
}

/**
 * Updates the status of an activity and the performance summaries.
 * @param {string} userId - The UID of the user.
 * @param {string} dateString - The date in YYYY-MM-DD format.
 * @param {object} activityToUpdate - The original activity object.
 * @param {string} newStatus - The new status of the activity.
 * @returns {Promise<void>}
 */
export async function updateActivityStatus(userId, dateString, activityToUpdate, newStatus) {
    try {
        const userDocRef = doc(db, "users", userId);
        const dailyReportRef = doc(db, "users", userId, "dailyActivities", dateString);
        const oldStatus = activityToUpdate.status;
        
        // Update the activity status in the array
        const updatedActivity = { ...activityToUpdate, status: newStatus };
        
        // To update an item in an array, you must remove the old one and add the new one
        await updateDoc(dailyReportRef, {
            activities: arrayRemove(activityToUpdate)
        });
        await updateDoc(dailyReportRef, {
            activities: arrayUnion(updatedActivity),
            [oldStatus]: increment(-1),
            [newStatus]: increment(1)
        });

        // Update the overall performance summary
        await updateDoc(userDocRef, {
            [`performanceSummary.${oldStatus}`]: increment(-1),
            [`performanceSummary.${newStatus}`]: increment(1)
        });

        console.log("Activity status updated and performance summaries adjusted.");
    } catch (error) {
        console.error("Error updating activity status:", error.message);
        throw error;
    }
}

/**
 * Deletes an activity and updates the performance summaries.
 * @param {string} userId - The UID of the user.
 * @param {string} dateString - The date in YYYY-MM-DD format.
 * @param {object} activityToDelete - The activity object to delete.
 * @param {string} status - The status of the activity being deleted.
 * @returns {Promise<void>}
 */
export async function deleteActivity(userId, dateString, activityToDelete, status) {
    try {
        const userDocRef = doc(db, "users", userId);
        const dailyReportRef = doc(db, "users", userId, "dailyActivities", dateString);

        // Remove the activity from the array
        await updateDoc(dailyReportRef, {
            activities: arrayRemove(activityToDelete),
            [status]: increment(-1)
        });

        // Update the overall performance summary
        await updateDoc(userDocRef, {
            [`performanceSummary.${status}`]: increment(-1)
        });

        console.log("Activity deleted and performance summaries adjusted.");
    } catch (error) {
        console.error("Error deleting activity:", error.message);
        throw error;
    }
}

/**
 * Logs in an existing user with email and password.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<UserCredential>} A promise that resolves with user credentials.
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("User logged in:", userCredential.user);
        return userCredential;
    } catch (error) {
        console.error("Error logging in user:", error.message);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Sends a password reset email to the given email address.
 * @param {string} email - The email address to send the reset link to.
 * @returns {Promise<void>} A promise that resolves when the email is sent.
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log("Password reset email sent to:", email);
    } catch (error) {
        console.error("Error sending password reset email:", error.message);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Logs out the current user.
 * @returns {Promise<void>} A promise that resolves when the user is logged out.
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        console.log("User logged out successfully.");
    } catch (error) {
        console.error("Error logging out user:", error.message);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Sets up an authentication state change listener.
 * @param {function(User|null)} callback - The callback function to be called when the auth state changes.
 */
export function setupAuthChangeListener(callback) {
    onAuthStateChanged(auth, callback);
}

// Export the auth and db objects if needed for direct access in other modules
export { auth, app, db };