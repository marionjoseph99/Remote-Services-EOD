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
    onSnapshot,
    serverTimestamp,
    collection,
    query,
    where,
    updateDoc,
    deleteDoc,
    writeBatch
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

// Authentication Functions
export const registerUser = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
};

export const updateUserProfile = (user, name) => {
    return updateProfile(user, {
        displayName: name
    });
};

export const loginUser = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
};

export const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
};

export const logoutUser = () => {
    return signOut(auth);
};

export const setupAuthChangeListener = (callback, errorCallback) => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            callback(user);
        } else {
            callback(null);
        }
    }, errorCallback);
};

// Firestore Functions
export const saveUserDetailsToFirestore = async (userId, userDetails) => {
    try {
        await setDoc(doc(db, "users", userId), userDetails);
    } catch (e) {
        throw new Error("Error adding user details: ", e);
    }
};

export const getAllUserDataFromFirestore = async (userId) => {
    try {
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (e) {
        throw new Error("Error getting user data: ", e);
    }
};

export const addActivity = async (userId, activity) => {
    try {
        const batch = writeBatch(db);
        let activityCollection;
        let updateData = {};

        if (activity.status === 'done' || activity.status === 'cancelled') {
            activityCollection = collection(db, `users/${userId}/dailyReports`);
            updateData = {
                completionDate: activity.completionDate,
                text: activity.text,
                description: activity.description,
                status: activity.status,
                timestamp: activity.timestamp,
                creationDate: activity.completionDate,
            };
        } else {
            activityCollection = collection(db, `users/${userId}/ongoingTasks`);
            updateData = {
                creationDate: activity.creationDate,
                text: activity.text,
                description: activity.description,
                status: activity.status,
                timestamp: activity.timestamp,
            };
        }

        const newActivityRef = doc(activityCollection);
        batch.set(newActivityRef, {
            ...updateData,
            id: newActivityRef.id,
            createdAt: serverTimestamp(),
        });

        // Update user performance summary
        const userRef = doc(db, `users/${userId}`);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const performanceSummary = userData.performanceSummary || {
            done: 0,
            wip: 0,
            'not-started': 0,
            cancelled: 0
        };
        if (performanceSummary[activity.status] !== undefined) {
            performanceSummary[activity.status]++;
        }
        batch.update(userRef, {
            performanceSummary: performanceSummary
        });

        await batch.commit();
    } catch (e) {
        throw new Error("Error adding activity: ", e);
    }
};

export const updateActivityContent = async (userId, activityId, collectionName, newText, newDescription) => {
    try {
        const activityRef = doc(db, `users/${userId}/${collectionName}/${activityId}`);
        await updateDoc(activityRef, {
            text: newText,
            description: newDescription
        });
    } catch (e) {
        throw new Error("Error updating activity content: ", e);
    }
};


export const updateActivityStatus = async (userId, activity, newStatus, date) => {
    const oldStatus = activity.status;

    try {
        const batch = writeBatch(db);
        const oldCollectionName = (oldStatus === 'wip' || oldStatus === 'not-started') ? 'ongoingTasks' : 'dailyReports';
        const newCollectionName = (newStatus === 'wip' || newStatus === 'not-started') ? 'ongoingTasks' : 'dailyReports';
        const oldActivityRef = doc(db, `users/${userId}/${oldCollectionName}/${activity.id}`);

        if (oldCollectionName !== newCollectionName) {
            // Move activity to the new collection
            const now = new Date();
            const timestamp = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Chicago'
            });

            const newActivityRef = doc(db, `users/${userId}/${newCollectionName}/${activity.id}`);
            let updateData = {
                ...activity,
                status: newStatus,
                timestamp: timestamp
            };

            if (newStatus === 'done' || newStatus === 'cancelled') {
                updateData.completionDate = date;
                updateData.creationDate = activity.creationDate || date;
            } else {
                updateData.creationDate = activity.creationDate || date;
                delete updateData.completionDate;
            }
            batch.set(newActivityRef, updateData);
            batch.delete(oldActivityRef);
        } else {
            // Update status within the same collection
            batch.update(oldActivityRef, {
                status: newStatus
            });
        }

        // Update user performance summary
        const userRef = doc(db, `users/${userId}`);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const performanceSummary = userData.performanceSummary || {
            done: 0,
            wip: 0,
            'not-started': 0,
            cancelled: 0
        };

        if (performanceSummary[oldStatus] > 0) {
            performanceSummary[oldStatus]--;
        }
        if (performanceSummary[newStatus] !== undefined) {
            performanceSummary[newStatus]++;
        }
        batch.update(userRef, {
            performanceSummary: performanceSummary
        });

        await batch.commit();

    } catch (e) {
        throw new Error("Error updating activity status: ", e);
    }
};

export const deleteActivity = async (userId, activity) => {
    try {
        const batch = writeBatch(db);
        const collectionName = (activity.status === 'wip' || activity.status === 'not-started') ? 'ongoingTasks' : 'dailyReports';
        const activityRef = doc(db, `users/${userId}/${collectionName}/${activity.id}`);
        batch.delete(activityRef);

        // Update user performance summary
        const userRef = doc(db, `users/${userId}`);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const performanceSummary = userData.performanceSummary || {
            done: 0,
            wip: 0,
            'not-started': 0,
            cancelled: 0
        };
        if (performanceSummary[activity.status] > 0) {
            performanceSummary[activity.status]--;
        }
        batch.update(userRef, {
            performanceSummary: performanceSummary
        });

        await batch.commit();

    } catch (e) {
        throw new Error("Error deleting activity: ", e);
    }
};


export const setupDailyActivitiesListener = (userId, date, callback) => {
    const q = query(
        collection(db, `users/${userId}/dailyReports`),
        where("completionDate", "==", date)
    );
    return onSnapshot(q, (querySnapshot) => {
        const activities = [];
        querySnapshot.forEach((doc) => {
            activities.push(doc.data());
        });
        callback(activities);
    });
};


export const setupOngoingTasksListener = (userId, callback) => {
    const q = query(
        collection(db, `users/${userId}/ongoingTasks`),
        where("status", "in", ['wip', 'not-started'])
    );
    return onSnapshot(q, (querySnapshot) => {
        const tasks = [];
        querySnapshot.forEach((doc) => {
            tasks.push(doc.data());
        });
        callback(tasks);
    });
};

export {
    db
};
