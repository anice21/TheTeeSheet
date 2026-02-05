import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBc-YiFWYqxWxn1p-RmT42Si2oI391J3ZI",
  authDomain: "golfleaderboard-8e6e7.firebaseapp.com",
  databaseURL: "https://golfleaderboard-8e6e7-default-rtdb.firebaseio.com",
  projectId: "golfleaderboard-8e6e7",
  storageBucket: "golfleaderboard-8e6e7.firebasestorage.app",
  messagingSenderId: "615429660316",
  appId: "1:615429660316:web:553307aaa6de2faf021759",
  measurementId: "G-JE4QKZ7P01"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
