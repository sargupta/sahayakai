'use client';

import { useState } from 'react';
import { Wrench, CheckCircle, Search, Rocket, Hourglass, FileText, Download, XCircle, BookOpen } from 'lucide-react';

export default function APIPlayground() {
    const [selectedSpec, setSelectedSpec] = useState('analytics');
    const [userId, setUserId] = useState('');
    const [email, setEmail] = useState('');
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const specs = {
        analytics: { name: 'Teacher Analytics', file: 'analytics.yaml' },
        'auth-user': { name: 'Auth & User', file: 'auth-user.yaml' },
        assistant: { name: 'Voice Assistant', file: 'assistant.yaml' },
        'lesson-plan': { name: 'Lesson Plan Generator', file: 'lesson-plan.yaml' },
        quiz: { name: 'Quiz Generator', file: 'quiz-generator.yaml' },
        worksheet: { name: 'Worksheet Wizard', file: 'worksheet.yaml' },
        'visual-aid': { name: 'Visual Aid Designer', file: 'visual-aid.yaml' },
        'instant-answer': { name: 'Instant Answer', file: 'instant-answer.yaml' },
        rubric: { name: 'Rubric Generator', file: 'rubric.yaml' },
        'teacher-training': { name: 'Teacher Training', file: 'teacher-training.yaml' },
        'virtual-field-trip': { name: 'Virtual Field Trip', file: 'virtual-field-trip.yaml' },
        intent: { name: 'Intent Router', file: 'intent.yaml' },
        content: { name: 'Content Management', file: 'content-management.yaml' },
        system: { name: 'System Health', file: 'system.yaml' },
    };

    const testTeacherHealth = async () => {
        if (!userId) {
            setError('Please enter a User ID');
            return;
        }

        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch(`/api/analytics/teacher-health/${userId}`);
            const data = await res.json();
            setResponse({ status: res.status, data });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testProfileCheck = async () => {
        if (!userId) {
            setError('Please enter a User ID');
            return;
        }

        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch(`/api/auth/profile-check?uid=${userId}`);
            const data = await res.json();
            setResponse({ status: res.status, data });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const testSystemHealth = async () => {
        setLoading(true);
        setError('');
        setResponse(null);

        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setResponse({ status: res.status, data });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-card rounded-xl shadow-soft border border-border p-6 mb-6 border-t-4 border-t-primary">
                    <h1 className="text-3xl font-headline font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
                        <Wrench className="h-7 w-7" /> SahayakAI API Playground
                    </h1>
                    <p className="text-muted-foreground">
                        Interactive API testing for all 22 SahayakAI endpoints
                    </p>
                    <div className="mt-4 flex gap-2">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> 14 Specs Available
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            22 Endpoints
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Spec Selector */}
                    <div className="lg:col-span-1">
                        <div className="bg-card rounded-xl shadow-soft border border-border p-6">
                            <h2 className="text-xl font-bold mb-4">Select API</h2>
                            <div className="space-y-2">
                                {Object.entries(specs).map(([key, spec]) => (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedSpec(key)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition ${selectedSpec === key
                                                ? 'bg-primary text-primary-foreground font-medium border border-primary'
                                                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            }`}
                                    >
                                        {spec.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-card rounded-xl shadow-soft border border-border p-6 mt-6">
                            <h2 className="text-xl font-bold mb-4">Quick Tests</h2>
                            <div className="space-y-3">
                                <button
                                    onClick={testSystemHealth}
                                    disabled={loading}
                                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                                >
                                    <Search className="h-4 w-4 inline-block mr-1" /> Check System Health
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Test Interface */}
                    <div className="lg:col-span-2">
                        <div className="bg-card rounded-xl shadow-soft border border-border p-6">
                            <h2 className="text-xl font-bold mb-4">
                                {specs[selectedSpec as keyof typeof specs].name}
                            </h2>

                            {/* Teacher Analytics Test */}
                            {selectedSpec === 'analytics' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            User ID (Firebase UID)
                                        </label>
                                        <input
                                            type="text"
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            placeholder="nYqFxBohXrSaL3EBF1f3M2x0pLf2"
                                            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Get UID from Firebase Console (users collection) or use script: npm run teacher:lookup email@example.com
                                        </p>
                                    </div>

                                    <button
                                        onClick={testTeacherHealth}
                                        disabled={loading}
                                        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
                                    >
                                        {loading ? <><Hourglass className="h-4 w-4 inline-block mr-1" /> Testing...</> : <><Rocket className="h-4 w-4 inline-block mr-1" /> GET /api/analytics/teacher-health/{'{userId}'}</>}
                                    </button>

                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm font-medium text-blue-900 mb-2">Expected Response:</p>
                                        <pre className="text-xs text-blue-800 overflow-x-auto">
                                            {`{
  "score": 78,
  "risk_level": "healthy",
  "activity_score": 25,
  "engagement_score": 28,
  "success_score": 15,
  "growth_score": 10,
  "days_since_last_use": 1,
  "consecutive_days_used": 5,
  "estimated_students_impacted": 120
}`}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Auth & User Test */}
                            {selectedSpec === 'auth-user' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            User ID (Firebase UID)
                                        </label>
                                        <input
                                            type="text"
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            placeholder="nYqFxBohXrSaL3EBF1f3M2x0pLf2"
                                            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                                        />
                                    </div>

                                    <button
                                        onClick={testProfileCheck}
                                        disabled={loading}
                                        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
                                    >
                                        {loading ? <><Hourglass className="h-4 w-4 inline-block mr-1" /> Testing...</> : <><Rocket className="h-4 w-4 inline-block mr-1" /> GET /api/auth/profile-check</>}
                                    </button>
                                </div>
                            )}

                            {/* System Health */}
                            {selectedSpec === 'system' && (
                                <div className="space-y-4">
                                    <button
                                        onClick={testSystemHealth}
                                        disabled={loading}
                                        className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
                                    >
                                        {loading ? <><Hourglass className="h-4 w-4 inline-block mr-1" /> Testing...</> : <><Rocket className="h-4 w-4 inline-block mr-1" /> GET /api/health</>}
                                    </button>
                                </div>
                            )}

                            {/* Default (View Spec) */}
                            {!['analytics', 'auth-user', 'system'].includes(selectedSpec) && (
                                <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <p className="text-yellow-900 font-medium mb-2 flex items-center gap-1">
                                        <FileText className="h-4 w-4" /> OpenAPI Spec Available
                                    </p>
                                    <p className="text-sm text-yellow-800 mb-4">
                                        This API has a complete OpenAPI specification. Interactive testing for this endpoint coming soon!
                                    </p>
                                    <a
                                        href={`/api-specs/${specs[selectedSpec as keyof typeof specs].file}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                                    >
                                        <Download className="h-4 w-4 inline-block mr-1" /> Download Spec
                                    </a>
                                </div>
                            )}

                            {/* Response Display */}
                            {error && (
                                <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                                    <p className="text-red-900 font-medium flex items-center gap-1"><XCircle className="h-4 w-4" /> Error</p>
                                    <p className="text-sm text-red-800 mt-1">{error}</p>
                                </div>
                            )}

                            {response && (
                                <div className="mt-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium">Response:</span>
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${response.status === 200
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}
                                        >
                                            {response.status}
                                        </span>
                                    </div>
                                    <pre className="p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto text-sm">
                                        {JSON.stringify(response.data, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        {/* Documentation Link */}
                        <div className="bg-primary rounded-xl shadow-soft p-6 mt-6 text-primary-foreground">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><BookOpen className="h-5 w-5" /> Full API Documentation</h3>
                            <p className="text-primary-foreground/80 mb-4">
                                View complete OpenAPI 3.0 specifications for all 22 endpoints
                            </p>
                            <div className="flex gap-3">
                                <a
                                    href="/docs/TEACHER_LOOKUP.md"
                                    className="px-4 py-2 bg-background text-primary rounded-lg font-medium hover:bg-background/90 transition"
                                >
                                    Teacher Lookup Guide
                                </a>
                                <a
                                    href="/docs/MONITORING.md"
                                    className="px-4 py-2 bg-background text-primary rounded-lg font-medium hover:bg-background/90 transition"
                                >
                                    Monitoring Guide
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
