// File: highlight.js
import { db } from './auth.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Base manager for simple per-day HTML content stored under a subcollection
class BaseDailyHtmlManager {
  constructor(userId, date, subcollection) {
    this.userId = userId;
    this.date = date;
    this.subcollection = subcollection;
  }
  setUser(userId) { this.userId = userId; }
  setDate(date) { this.date = date; }
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  getDocRef() {
    const dateKey = this.formatDate(this.date);
    return doc(db, 'users', this.userId, this.subcollection, dateKey);
  }
  async load() {
    try {
      const docRef = this.getDocRef();
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) return docSnap.data().content || '';
      return '';
    } catch (e) {
      console.error(`Failed to load ${this.subcollection}:`, e);
      return '';
    }
  }
  async save(content) {
    try {
      const docRef = this.getDocRef();
      await setDoc(docRef, { content });
    } catch (e) {
      console.error(`Failed to save ${this.subcollection}:`, e);
      throw e;
    }
  }
  formatToHTML(content) { return content || ''; }
}

export class HighlightManager extends BaseDailyHtmlManager {
  constructor(userId, date) { super(userId, date, 'highlights'); }
}

// New: Inquiries / Challenges manager (same structure as highlights)
export class InquiriesManager extends BaseDailyHtmlManager {
  constructor(userId, date) { super(userId, date, 'inquiries'); }
}
