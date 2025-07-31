// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsWm4xczbTsovHHq-pTNYu3XAkqXUBQQA",
  authDomain: "eod-login.firebaseapp.com",
  projectId: "eod-login",
  storageBucket: "eod-login.appspot.com",
  messagingSenderId: "648733889268",
  appId: "1:648733889268:web:your-app-id" // optional
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };
