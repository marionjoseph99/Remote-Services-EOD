// File: highlight.js
import { db } from './auth.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

export class HighlightManager {
    constructor(userId, date) {
        this.userId = userId;
        this.date = date;
    }

    setDate(date) {
        this.date = date;
    }

    getHighlightDocRef() {
        // Use YYYY-MM-DD as key for each day's highlight
        const dateKey = this.formatDate(this.date);
        return doc(db, 'users', this.userId, 'highlights', dateKey);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async load() {
        try {
            const docRef = this.getHighlightDocRef();
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data().content || '';
            }
            return '';
        } catch (error) {
            console.error('Failed to load highlight:', error);
            return '';
        }
    }

    async save(content) {
        try {
            const docRef = this.getHighlightDocRef();
            await setDoc(docRef, { content });
        } catch (error) {
            console.error('Failed to save highlight:', error);
            throw error;
        }
    }

    formatToHTML(content) {
        // No markdown needed, just return HTML
        return content || '';
    }
}
