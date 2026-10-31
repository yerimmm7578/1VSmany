```javascript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyBc_-rFWIcEnl9FCTTx3Knh6sUuWCSfGlA",
  authDomain: "vsmany.firebaseapp.com",
  projectId: "vsmany",
  storageBucket: "vsmany.firebasestorage.app",
  messagingSenderId: "1069585880074",
  appId: "1:1069585880074:web:f92b1488393e04b0c9bbf3",
  measurementId: "G-JS6E7VPE92"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Firebase 서비스 연결
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-northeast3");
```
