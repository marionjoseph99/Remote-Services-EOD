import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// DOM Elements
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const signInBtn = document.getElementById('signInBtn');
const startRegisterBtn = document.getElementById('startRegisterBtn');
const completeRegisterBtn = document.getElementById('completeRegisterBtn');
const messageEl = document.getElementById('authMessage');

// Start Register Flow (Step 1)
startRegisterBtn.addEventListener('click', () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();

  if (!email || !password) {
    showMessage('Enter email and password to continue.');
    return;
  }

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const uid = userCredential.user.uid;
      localStorage.setItem('temp-uid', uid); // Temporarily store UID
      step1.classList.add('hidden');
      step2.classList.remove('hidden');
    })
    .catch(err => showMessage(err.message));
});

// Finish Register (Step 2)
completeRegisterBtn.addEventListener('click', () => {
  const name = document.getElementById('register-name').value.trim();
  const client = document.getElementById('register-client').value.trim();
  const position = document.getElementById('register-position').value.trim();
  const uid = localStorage.getItem('temp-uid');

  if (!name || !client || !position) {
    showMessage('Please fill out all fields.');
    return;
  }

  if (uid) {
    localStorage.setItem(`profile-${uid}`, JSON.stringify({ name, client, position }));
    localStorage.removeItem('temp-uid');
    window.location.href = 'index.html';
  } else {
    showMessage("Something went wrong. Try again.");
  }
});

// Sign In
signInBtn.addEventListener('click', () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();

  if (!email || !password) {
    showMessage('Enter email and password.');
    return;
  }

  signInWithEmailAndPassword(auth, email, password)
    .then(() => window.location.href = 'index.html')
    .catch(err => showMessage(err.message));
});

// Show error message
function showMessage(msg) {
  messageEl.textContent = msg;
  messageEl.classList.remove('hidden');
}
