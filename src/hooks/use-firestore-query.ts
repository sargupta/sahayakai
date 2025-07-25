// src/hooks/use-firestore-query.ts
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, Query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useFirestoreQuery<T>(path: string | undefined) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    const q: Query = query(collection(db, path));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: T[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as T);
      });
      setData(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [path]);

  return { data, loading };
}