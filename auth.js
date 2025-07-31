import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const messageEl = document.getElementById('authMessage');

signInBtn.addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    window.location.href = 'index.html';
  } catch (err) {
    showError(err.message);
  }
});

signUpBtn.addEventListener('click', async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    window.location.href = 'index.html';
  } catch (err) {
    showError(err.message);
  }
});

const showError = (msg) => {
  messageEl.textContent = msg;
  messageEl.classList.remove('hidden');
};
