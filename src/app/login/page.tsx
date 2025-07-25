// src/app/login/page.tsx
"use client";

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: 'Login Successful' });
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast({ title: 'Account Created Successfully' });
      }
      router.push('/');
    } catch (error: any) {
      toast({
        title: 'Authentication Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isLogin ? 'Login' : 'Sign Up'}</CardTitle>
          <CardDescription>
            {isLogin ? 'Enter your credentials to login.' : 'Create an account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              {isLogin ? 'Login' : 'Sign Up'}
            </Button>
          </form>
          <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="w-full mt-4">
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
