"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, EyeOff, Server, Trash2 } from "lucide-react";
import Link from "next/link";

export default function PrivacyForTeachersPage() {
    return (
        <div className="w-full max-w-3xl mx-auto py-6 space-y-6">
            <div className="text-center space-y-3">
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                    <Shield className="h-8 w-8 text-primary" />
                </div>
                <h1 className="font-headline text-3xl font-bold text-slate-900">
                    Your Data, Your Control
                </h1>
                <p className="text-slate-600 max-w-xl mx-auto">
                    SahayakAI is built for teachers, not for monitoring teachers. Here is exactly how we handle your data.
                </p>
            </div>

            <div className="grid gap-4">
                <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="p-6 flex gap-4">
                        <div className="shrink-0 mt-1">
                            <EyeOff className="h-6 w-6 text-green-700" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-green-900 text-lg mb-2">
                                We NEVER share your data with inspectors or government officials
                            </h3>
                            <p className="text-green-800 text-sm leading-relaxed">
                                Your lesson plans, quiz results, attendance records, parent call logs, and all other activity data will never be shared with any Block Education Officer (BEO), District Education Officer (DEO), DIET Principal, school inspector, or any other government official — unless YOU explicitly choose to share it yourself.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex gap-4">
                        <div className="shrink-0 mt-1">
                            <Lock className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-lg mb-2">
                                Your content is private by default
                            </h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Every lesson plan, quiz, worksheet, and visual aid you create is visible only to you. Nothing is shared publicly unless you explicitly tap "Share to Community." You can remove shared content at any time.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex gap-4">
                        <div className="shrink-0 mt-1">
                            <Eye className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-lg mb-2">
                                No school dashboard tracks individual teachers
                            </h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                SahayakAI does not provide any dashboard, report, or view that allows a principal, HM, or administrator to monitor individual teacher activity. If we ever build school-level features, they will show only aggregate, anonymised data — and will require your explicit opt-in.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex gap-4">
                        <div className="shrink-0 mt-1">
                            <Server className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-lg mb-2">
                                Voice recordings are processed, not stored
                            </h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                When you use voice input, your speech is converted to text to create your lesson plan or quiz. The voice recording itself is not permanently stored on our servers. Community voice messages you send are stored only for the conversation participants.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex gap-4">
                        <div className="shrink-0 mt-1">
                            <Trash2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-lg mb-2">
                                You can delete your data anytime
                            </h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                You can delete individual lesson plans, quizzes, and other content from your library at any time. If you want to delete your entire account and all associated data, contact us and we will process it within 7 days.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="text-center pt-4">
                <p className="text-sm text-slate-500">
                    Questions about your privacy? Contact us at{" "}
                    <a href="mailto:support@sahayak.ai" className="text-primary underline">support@sahayak.ai</a>
                </p>
                <Link href="/" className="text-sm text-primary font-medium hover:underline mt-2 inline-block">
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
