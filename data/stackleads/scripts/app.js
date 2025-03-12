// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA7pyvhNby_Y_I1b-Q22rHuYX2EjXKo8Ic",
  authDomain: "stackleads-d18bb.firebaseapp.com",
  projectId: "stackleads-d18bb",
  storageBucket: "stackleads-d18bb.firebasestorage.app",
  messagingSenderId: "53576063990",
  appId: "1:53576063990:web:98fca0f9190c99f8db05d7",
  measurementId: "G-P5QFCT3L5Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);