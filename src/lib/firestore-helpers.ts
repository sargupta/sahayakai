// src/lib/firestore-helpers.ts
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

export const addUserToFirestore = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    createdAt: serverTimestamp(),
  }, { merge: true });
};