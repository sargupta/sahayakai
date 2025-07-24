
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/lesson-plan-agent');
  }, [router]);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </main>
  );
}
