"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Globe, ShieldCheck, Layers, TrendingUp, Calendar, ShieldAlert, AlertCircle, UploadCloud, CalendarCheck, ShieldX } from "lucide-react";
import { useConnection } from "@/hooks/use-connection";


export function DashboardStats() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const {
        indexingStatus,
        connectedSitesCount,
        sitesWithPermission,
        sitesWithoutPermission,
        isLoading: isConnectionLoading
    } = useConnection();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const statsRes = await fetch("/api/dashboard/stats");

                if (statsRes.ok) {
                    const statsResult = await statsRes.json();
                    setStats(statsResult);
                } else {
                    setStats(null);
                }

            } catch (err) {
                console.error("Dashboard Stats Error:", err);
                setStats(null);
            } finally {
                setLoading(false);
            }
        };

        if (indexingStatus === "CONNECTED" || indexingStatus === "PARTIAL") {
            fetchData();
        } else if (indexingStatus === "DISCONNECTED") {
            setLoading(false);
            setStats(null);
        }
    }, [indexingStatus]);

    const getPermissionBadgeVariant = (level) => {
        switch (level) {
            case "siteOwner": return "default"; // Primary color
            case "siteFullUser": return "secondary";
            case "siteRestrictedUser": return "outline";
            default: return "secondary";
        }
    };

    const formatPermission = (level) => {
        return level.replace("site", "").replace("User", "").toUpperCase();
    };

    // 1. DISCONNECTED / NOT VERIFIED (Highest Priority)
    // 1. DISCONNECTED / NOT VERIFIED (Highest Priority)
    // The loader must NEVER render when: Status = disconnected, Status = error, Status = idle
    if (indexingStatus === "DISCONNECTED" || indexingStatus === "NOT_VERIFIED" || indexingStatus === "UNKNOWN" || indexingStatus === "idle") {
        return (
            <Card className="w-full shadow-sm border-dashed bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
                    <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 transition-colors">
                        <AlertCircle className="h-6 w-6 text-zinc-400" />
                    </div>
                    <div className="max-w-[400px] space-y-2">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                            {indexingStatus === "NOT_VERIFIED"
                                ? "Service account not verified"
                                : "Google Search Console is disconnected."}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {indexingStatus === "NOT_VERIFIED" && (
                            "Please upload a valid service account JSON file to connect your website."
                            )}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // 2. ERROR / EMPTY DATA (Fallback if no stats but not loading/disconnected)
    if (!stats && !loading && !isConnectionLoading && indexingStatus !== "checking" && indexingStatus !== "connecting") {
        return (
            <div className="flex flex-wrap gap-6 w-full">
                {/* Always show connectivity status cards if possible, or a soft empty state */}
                <Card className="w-full shadow-sm border-dashed bg-zinc-50/50 dark:bg-zinc-900/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
                        <Layers className="h-10 w-10 text-zinc-300 mb-4" />
                        <p className="text-sm">No submission history found yet for your properties.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 3. CHECKING / CONNECTING (Loader) - The loader must ONLY render in these states
    if (indexingStatus === "checking" || indexingStatus === "connecting") {
        return (
            <div className="flex justify-center py-20 w-full text-zinc-300">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    // 4. STATS STILL LOADING (But status is already CONNECTED/PARTIAL/etc)
    if (loading || isConnectionLoading) {
        return (
            <div className="flex justify-center py-20 w-full text-zinc-300">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-6">

            {/* Card 1: Total Connected Websites */}
            {connectedSitesCount > 0 && (
                <Card className="w-[300px] h-auto flex flex-col justify-between shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            Total Connected Websites
                        </h4>
                        <Globe className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-zinc-900">{connectedSitesCount}</div>
                    </CardContent>
                    <div className="px-6 pb-4">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">
                            Validated Google Search Console Properties
                        </p>
                    </div>
                </Card>
            )}

            {/* Card 2: Websites with Permission */}
            {sitesWithPermission > 0 && (
                <Card className="w-[300px] h-auto flex flex-col justify-between shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            Website with Permission
                        </h4>
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-green-600">{sitesWithPermission}</div>
                    </CardContent>
                    <div className="px-6 pb-4">
                        <p className="text-[10px] font-bold text-green-700 uppercase">
                            Full indexing access granted
                        </p>
                    </div>
                </Card>
            )}

            {/* Card 3: Websites without Permission */}
            {sitesWithoutPermission > 0 && (
                <Card className="w-[300px] h-auto flex flex-col justify-between shadow-sm border-amber-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            Website Without Permission
                        </h4>
                        <ShieldX className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-amber-600">{sitesWithoutPermission}</div>
                    </CardContent>
                    <div className="px-6 pb-4">
                        <p className="text-[10px] font-bold text-amber-700 uppercase">
                            Fix GSC permissions to enable
                        </p>
                    </div>
                </Card>
            )}

            {/* Card 4: Overall Submission Count */}
            {stats && stats.hasHistory && (
                <Card className="w-[300px] h-auto flex flex-col justify-between shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            Overall Submission Count
                        </h4>
                        <UploadCloud className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-zinc-900">{stats.totalSubmissions || 0}</div>
                    </CardContent>
                    <div className="px-6 pb-4">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">
                            Total URLs submitted through indexing requests
                        </p>
                    </div>
                </Card>
            )}

            {/* Card 5: Success Rate */}
            {stats && stats.hasHistory && (
                <Card className="w-[300px] h-auto flex flex-col justify-between shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            Success Rate
                        </h4>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-emerald-600">{stats.successRate || "0.0"}%</div>
                    </CardContent>
                    <div className="px-6 pb-4">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase">
                            Success rate of indexing submissions
                        </p>
                    </div>
                </Card>
            )}

            {/* Card 6: Submitted URLs Today */}
            {stats && stats.hasHistory && (
                <Card className="w-[300px] h-auto flex flex-col justify-between shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            Submitted URLs Today
                        </h4>
                        <CalendarCheck className="h-4 w-4 text-sky-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-zinc-900">{stats.count || 0}</div>
                    </CardContent>
                    <div className="px-6 pb-4">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">
                            Total URLs submitted today via indexing requests
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
}
