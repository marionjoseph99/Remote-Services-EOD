// File: auth.js

// Import the functions you need from the SDKs you need
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
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
    updateDoc,
    increment,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    writeBatch,
    onSnapshot
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
const db = getFirestore(app);

export async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("User registered:", userCredential.user);
        return userCredential;
    } catch (error) {
        console.error("Error registering user:", error.message);
        throw error;
    }
}

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
 * Sets up a real-time listener for daily completed/cancelled activities for a specific date.
 * @param {string} userId - The UID of the user.
 * @param {string} dateString - The date in YYYY-MM-DD format.
 * @param {function} callback - The callback function to execute on data change.
 * @returns {function} An unsubscribe function to stop the listener.
 */
export function setupDailyActivitiesListener(userId, dateString, callback) {
    const dailyReportsRef = collection(db, "users", userId, "dailyReports");
    const q = query(dailyReportsRef, where("completionDate", "==", dateString));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const activities = [];
        querySnapshot.forEach((doc) => {
            activities.push(doc.data());
        });
        callback(activities);
    }, (error) => {
        console.error("Error setting up daily activities listener:", error.message);
    });

    return unsubscribe;
}

/**
 * Sets up a real-time listener for all ongoing (wip/not-started) tasks.
 * @param {string} userId - The UID of the user.
 * @param {function} callback - The callback function to execute on data change.
 * @returns {function} An unsubscribe function to stop the listener.
 */
export function setupOngoingTasksListener(userId, callback) {
    const ongoingTasksRef = collection(db, "users", userId, "ongoingTasks");
    const q = query(ongoingTasksRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const ongoingTasks = [];
        querySnapshot.forEach((doc) => {
            ongoingTasks.push(doc.data());
        });
        callback(ongoingTasks);
    }, (error) => {
        console.error("Error setting up ongoing tasks listener:", error.message);
    });

    return unsubscribe;
}

/**
 * Adds a new activity to the appropriate collection (ongoing or daily report)
 * @param {string} userId - The UID of the user.
 * @param {object} newActivity - The new activity object to add.
 * @returns {Promise<void>}
 */
export async function addActivity(userId, newActivity) {
    try {
        const userDocRef = doc(db, "users", userId);
        const {
            status,
            id
        } = newActivity;

        if (status === 'wip' || status === 'not-started') {
            const ongoingTaskRef = doc(db, "users", userId, "ongoingTasks", String(id));
            await setDoc(ongoingTaskRef, newActivity);
        } else {
            const dailyReportRef = doc(db, "users", userId, "dailyReports", String(id));
            await setDoc(dailyReportRef, newActivity);
        }

        // Update the overall performance summary
        await updateDoc(userDocRef, {
            [`performanceSummary.${status}`]: increment(1)
        });

        console.log("Activity added and performance updated.");
    } catch (error) {
        console.error("Error adding activity:", error.message);
        throw error;
        // Rethrow the error so the UI can handle the failure
        throw error;
    }
}

/**
 * Updates the status of an activity and the performance summaries.
 * @param {string} userId - The UID of the user.
 * @param {object} activityToUpdate - The original activity object.
 * @param {string} newStatus - The new status of the activity.
 * @param {string} completionDate - The date when the task was completed.
 * @returns {Promise<void>}
 */
export async function updateActivityStatus(userId, activityToUpdate, newStatus, completionDate) {
    const oldStatus = activityToUpdate.status;

    if (oldStatus === newStatus) {
        console.log("Status is already the same, no update needed.");
        return;
    }

    const batch = writeBatch(db);
    const userDocRef = doc(db, "users", userId);

    // Update overall performance summary
    batch.update(userDocRef, {
        [`performanceSummary.${oldStatus}`]: increment(-1),
        [`performanceSummary.${newStatus}`]: increment(1)
    });


    // Handle moving between ongoing and daily reports
    if ((oldStatus === 'wip' || oldStatus === 'not-started') && (newStatus === 'done' || newStatus === 'cancelled')) {
        // Move from ongoingTasks to dailyReports
        const ongoingTaskRef = doc(db, "users", userId, "ongoingTasks", String(activityToUpdate.id));
        const dailyReportRef = doc(db, "users", userId, "dailyReports", String(activityToUpdate.id));
        const newActivity = {
            ...activityToUpdate,
            status: newStatus,
            completionDate: completionDate, // Use the provided completionDate
            creationDate: null,
        };

        batch.delete(ongoingTaskRef);
        batch.set(dailyReportRef, newActivity);

    } else if ((oldStatus === 'done' || oldStatus === 'cancelled') && (newStatus === 'wip' || newStatus === 'not-started')) {
        // Move from dailyReports to ongoingTasks
        const dailyReportRef = doc(db, "users", userId, "dailyReports", String(activityToUpdate.id));
        const ongoingTaskRef = doc(db, "users", userId, "ongoingTasks", String(activityToUpdate.id));
        const newActivity = {
            ...activityToUpdate,
            status: newStatus,
            creationDate: completionDate,
            completionDate: null
        };

        batch.delete(dailyReportRef);
        batch.set(ongoingTaskRef, newActivity);

    } else {
        // Status change within the same collection
        if (oldStatus === 'wip' || oldStatus === 'not-started') {
            const ongoingTaskRef = doc(db, "users", userId, "ongoingTasks", String(activityToUpdate.id));
            batch.update(ongoingTaskRef, {
                status: newStatus
            });
        } else {
            const dailyReportRef = doc(db, "users", userId, "dailyReports", String(activityToUpdate.id));
            batch.update(dailyReportRef, {
                status: newStatus
            });
        }
    }

    try {
        await batch.commit();
        console.log("Activity status updated and performance summaries adjusted.");
    } catch (error) {
        console.error("Error updating activity status:", error.message);
        throw error;
        // Rethrow the error so the UI can handle the failure
        throw error;
    }
}

/**
 * Deletes an activity and updates the performance summaries.
 * @param {string} userId - The UID of the user.
 * @param {object} activityToDelete - The activity object to delete.
 * @returns {Promise<void>}
 */
export async function deleteActivity(userId, activityToDelete) {
    try {
        const userDocRef = doc(db, "users", userId);
        const {
            status,
            id
        } = activityToDelete;

        // Reference to the activity document to delete
        let activityRef;
        if (status === 'wip' || status === 'not-started') {
            activityRef = doc(db, "users", userId, "ongoingTasks", String(id));
        } else {
            activityRef = doc(db, "users", userId, "dailyReports", String(id));
        }

        // Delete the document
        await deleteDoc(activityRef);

        // Update the overall performance summary
        await updateDoc(userDocRef, {
            [`performanceSummary.${status}`]: increment(-1)
        });

        console.log("Activity deleted and performance summaries adjusted.");
    } catch (error) {
        console.error("Error deleting activity:", error.message);
        throw error;
        // Rethrow the error so the UI can handle the failure
        throw error;
    }
}

export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("User logged in:", userCredential.user);
        return userCredential;
    } catch (error) {
        console.error("Error logging in user:", error.message);
        throw error;
    }
}

export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log("Password reset email sent to:", email);
    } catch (error) {
        console.error("Error sending password reset email:", error.message);
        throw error;
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
        console.log("User logged out successfully.");
    } catch (error) {
        console.error("Error logging out user:", error.message);
        throw error;
    }
}

export function setupAuthChangeListener(callback) {
    onAuthStateChanged(auth, callback);
}

// Export the auth and db objects
export {
    auth,
    app,
    db
};
