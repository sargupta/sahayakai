/**
 * @fileOverview Auth-gate hook for the exam-paper feature. Owns the
 * `onAuthStateChanged` subscription and exposes `authed`/`loading` plus the
 * teacher's `preferredBoard` (looked up once on first authenticated load).
 * The form hook consumes `preferredBoard` to default the board field.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getProfileData } from "@/app/actions/profile";
import { EDUCATION_BOARDS } from "@/types";

export interface ExamPaperAuthState {
  authed: boolean;
  loading: boolean;
  /** The teacher's saved board (validated against EDUCATION_BOARDS), or null. */
  preferredBoard: string | null;
}

export function useExamPaperAuth(): ExamPaperAuthState {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferredBoard, setPreferredBoard] = useState<string | null>(null);

  // Guard so the teacher's preferred board is looked up only once, on first
  // load — never re-fetched after auth state churns.
  const boardDefaultedRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(!!user);
      setLoading(false);
      // QA #9 — default the board field to the teacher's preferred board so
      // generated papers are board-aligned out of the box. Falls back to the
      // hardcoded "CBSE" default when no board is saved or it's unknown.
      if (user && !boardDefaultedRef.current) {
        getProfileData(user.uid)
          .then(({ profile }) => {
            const saved = (profile as { preferredBoard?: string; educationBoard?: string } | null);
            const board = saved?.preferredBoard ?? saved?.educationBoard;
            if (board && (EDUCATION_BOARDS as readonly string[]).includes(board) && !boardDefaultedRef.current) {
              boardDefaultedRef.current = true;
              setPreferredBoard(board);
            }
          })
          .catch(() => { /* non-fatal — keep the CBSE default */ });
      }
    });
    return () => unsub();
  }, []);

  return { authed, loading, preferredBoard };
}
