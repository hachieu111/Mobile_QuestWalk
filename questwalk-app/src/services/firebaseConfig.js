import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAYCcKqy877hY9JCyQjek-PAsnfWQhUiJo",
  authDomain: "questwalk-19b34.firebaseapp.com",
  projectId: "questwalk-19b34",
  storageBucket: "questwalk-19b34.firebasestorage.app",
  messagingSenderId: "710278515613",
  appId: "1:710278515613:web:531289ef672486d465fd74",
  measurementId: "G-JXSMCYPZ95"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
