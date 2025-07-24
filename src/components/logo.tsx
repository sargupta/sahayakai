import { BookOpenCheck } from 'lucide-react';
import type { FC } from 'react';

export const Logo: FC = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-lg bg-primary/20 p-2 text-primary">
        <BookOpenCheck className="h-6 w-6" />
      </div>
      <h1 className="font-headline text-2xl font-bold text-foreground">
        SahayakAI
      </h1>
    </div>
  );
};
