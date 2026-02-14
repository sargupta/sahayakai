import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            <div className="text-center space-y-6 max-w-md mx-auto">
                <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="w-12 h-12 text-blue-600" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-4xl font-bold text-slate-900">Page Not Found</h1>
                    <p className="text-slate-600 text-lg">
                        We couldn't find the page you're looking for. It might have been moved or deleted.
                    </p>
                </div>

                <div className="pt-4">
                    <Link href="/">
                        <Button size="lg" className="bg-primary hover:bg-primary/90">
                            Return Home
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="mt-12 text-slate-400 text-sm">
                SakayakAI &copy; {new Date().getFullYear()}
            </div>
        </div>
    );
}
