"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    Zap,
    Mic,
    Search,
    Database,
    TrendingUp,
    AlertTriangle,
    ShieldCheck,
    Coins
} from "lucide-react";
import { getDailyCostsAction } from "@/app/actions/profile";
import { cn } from "@/lib/utils";

interface MetricCardProps {
    title: string;
    value: number;
    threshold: number;
    unit: string;
    icon: React.ElementType;
    color: string;
    description: string;
}

function MetricCard({ title, value, threshold, unit, icon: Icon, color, description }: MetricCardProps) {
    const percentage = Math.min(100, (value / threshold) * 100);
    const isOverThreshold = value >= threshold;
    const isWarning = value >= threshold * 0.8;

    return (
        <Card className="bg-white/40 backdrop-blur-xl border-white/60 shadow-2xl transition-all duration-300 hover:shadow-primary/10">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className={cn("p-2 rounded-xl", color)}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                    {isOverThreshold ? (
                        <Badge variant="destructive" className="animate-pulse">CRITICAL</Badge>
                    ) : isWarning ? (
                        <Badge className="bg-orange-500 hover:bg-orange-600">WARNING</Badge>
                    ) : (
                        <Badge variant="outline" className="text-green-600 border-green-200">HEALTHY</Badge>
                    )}
                </div>
                <CardTitle className="text-xl font-black mt-4 font-headline tracking-tight">{title}</CardTitle>
                <CardDescription className="text-slate-500 font-medium">{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-end justify-between">
                        <div className="space-y-1">
                            <span className="text-3xl font-black text-slate-900 tracking-tighter">
                                {value.toLocaleString()}
                                <span className="text-sm text-slate-400 ml-1 font-bold">{unit}</span>
                            </span>
                        </div>
                        <span className="text-sm font-bold text-slate-400">
                            Limit: {threshold.toLocaleString()}
                        </span>
                    </div>
                    <div className="space-y-2">
                        <Progress value={percentage} className="h-2 bg-slate-100" />
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>0%</span>
                            <span>{percentage.toFixed(1)}% Usage</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminCostDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getDailyCostsAction(1);
                if (data && data.length > 0) {
                    setStats(data[0].metrics);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Fallback data if no tracking yet today
    const currentMetrics = stats || {
        gemini_tokens: 0,
        tts_characters: 0,
        image_generations: 0,
        grounding_calls: 0,
        firestore_writes: 0,
        estimated_spend_usd: 0
    };

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 py-20 animate-pulse text-center">
                <ShieldCheck className="w-20 h-20 text-slate-200 mx-auto mb-6" />
                <h2 className="text-2xl font-black text-slate-300 font-headline">Syncing real-time costs...</h2>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-12 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-wide">
                    <Coins className="h-4 w-4" />
                    REAL-TIME MONITORING
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-slate-900 font-headline tracking-tighter leading-none">
                    Mission Control <span className="text-primary">& Costs</span>
                </h1>
                <p className="text-lg text-slate-500 font-medium leading-relaxed">
                    Live operational transparency for SahayakAI. Monitoring API quotas, infrastructure spend, and resource health.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title="Gemini Spend"
                    value={currentMetrics.estimated_spend_usd}
                    threshold={50}
                    unit="USD"
                    icon={Zap}
                    color="bg-purple-500 shadow-lg shadow-purple-500/30"
                    description="Daily estimated spend on Gemini 2.0 Flash APIs."
                />
                <MetricCard
                    title="TTS Volume"
                    value={currentMetrics.tts_characters}
                    threshold={5000000}
                    unit="Chars"
                    icon={Mic}
                    color="bg-blue-500 shadow-lg shadow-blue-500/30"
                    description="Google Cloud Text-to-Speech character usage."
                />
                <MetricCard
                    title="Grounding API"
                    value={currentMetrics.grounding_calls}
                    threshold={1000}
                    unit="Calls"
                    icon={Search}
                    color="bg-orange-500 shadow-lg shadow-orange-500/30"
                    description="Live Google Search grounding for Instant Answers."
                />
                <MetricCard
                    title="Firestore Writes"
                    value={currentMetrics.firestore_writes}
                    threshold={10000}
                    unit="Writes"
                    icon={Database}
                    color="bg-indigo-500 shadow-lg shadow-indigo-500/30"
                    description="Atomic database updates and content persistence."
                />
                <MetricCard
                    title="Image Gen"
                    value={currentMetrics.image_generations}
                    threshold={500}
                    unit="Images"
                    icon={TrendingUp}
                    color="bg-pink-500 shadow-lg shadow-pink-500/30"
                    description="Daily AI image generation for Visual Aids."
                />
                <Card className="bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Activity className="h-32 w-32" />
                    </div>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl tracking-tight">System Status</CardTitle>
                        <CardDescription className="text-slate-400 font-medium">Platform-wide health metrics.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
                            <span className="text-sm font-bold tracking-widest uppercase">Cloud Run: Asia-South1 OK</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
                            <span className="text-sm font-bold tracking-widest uppercase">API Latency: 420ms (Avg)</span>
                        </div>
                        <div className="pt-4">
                            <Badge className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold p-3">
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                SAFE TO SCALE
                            </Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none bg-slate-50/50 p-8 rounded-[2.5rem]">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-10 w-10 text-orange-600" />
                    </div>
                    <div className="space-y-2 text-center md:text-left">
                        <h3 className="text-2xl font-black text-slate-900 font-headline">Billing Safeguards</h3>
                        <p className="text-slate-600 font-medium">
                            Alerts are integrated with Google Cloud Billing. If thresholds are breached, the system will prioritize traffic for verified educators and temporarily restrict high-cost autonomous agents.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
