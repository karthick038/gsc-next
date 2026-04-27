"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Calendar, ListTodo, History, Send, Clock3,
    RotateCcw, Zap, Loader2, AlertCircle,
    Save, CheckCircle2, History as HistoryIcon,
    Trash2, Info, Activity, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function SitemapSchedulerPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [settings, setSettings] = useState({
        sitemapBatchingEnabled: true,
        sitemapLastRunDate: null,
        sitemapNextRunDate: null,
        sitemapInterval: "14_DAYS",
        sitemapReferenceTime: "00:00",
        // Reporting specific
        reportingEnabled: true,
        reportingInterval: "14_DAYS",
        reportingReferenceTime: "00:00",
        reportingLastRunDate: null,
        reportingNextRunDate: null,
    });

    const [queue, setQueue] = useState([]);
    const [logs, setLogs] = useState([]);
    const [reportingLogs, setReportingLogs] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]);
    const [logCategory, setLogCategory] = useState("sitemap"); // "sitemap" | "reporting" | "system"
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [sendingBatch, setSendingBatch] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmSendBatch, setConfirmSendBatch] = useState(false);
    const [confirmCancelBatch, setConfirmCancelBatch] = useState(false);
    const [isClearingQueue, setIsClearingQueue] = useState(false);
    const [saving, setSaving] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [activeTab, setActiveTab] = useState("dashboard");
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deletingItems, setDeletingIds] = useState(new Set());
    const [displayLimit, setDisplayLimit] = useState(20);

    const format12h = (timeStr) => {
        if (!timeStr) return "12:00 AM";
        const [h, m] = timeStr.split(':');
        const hh = parseInt(h);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = hh % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    // 1. Initial configuration fetch
    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({
                    ...prev,
                    ...data
                }));
            }
        } catch (error) {
            console.error("Failed to fetch settings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    // 2. Polling for Live Data (Queue, Settings)
    useEffect(() => {
        const fetchSitemapData = async () => {
            try {
                // Fetch Queue & Processing State
                const queueRes = await fetch("/api/admin/sitemap/queue");
                if (queueRes.ok) {
                    const queueData = await queueRes.json();
                    setQueue(queueData.items || []);
                    setIsProcessing(queueData.isProcessing);
                }

                // Refresh Next Run calculation
                const settingsRes = await fetch("/api/settings");
                if (settingsRes.ok) {
                    const settingsData = await settingsRes.json();
                    setSettings(prev => ({
                        ...prev,
                        sitemapBatchingEnabled: settingsData.sitemapBatchingEnabled,
                        reportingEnabled: settingsData.reportingEnabled,
                        sitemapIsProcessing: settingsData.sitemapIsProcessing,
                        reportingIsProcessing: settingsData.reportingIsProcessing,
                        sitemapLastRunDate: settingsData.sitemapLastRunDate,
                        sitemapNextRunDate: settingsData.sitemapNextRunDate,
                        reportingLastRunDate: settingsData.reportingLastRunDate,
                        reportingNextRunDate: settingsData.reportingNextRunDate,
                        reportingPostAutomationRunDate: settingsData.reportingPostAutomationRunDate,
                    }));
                }
            } catch (error) {
                console.error("[SCHEDULER-DEBUG] Fetch error:", error);
            } finally {
                setLoadingQueue(false);
            }
        };

        const intervalDuration = (isProcessing || settings.isProcessing) ? 3000 : 15000;
        fetchSitemapData();
        const interval = setInterval(fetchSitemapData, intervalDuration);
        return () => clearInterval(interval);
    }, [isProcessing, settings.isProcessing]);

    // 3. Fetch logs per category
    const fetchLogs = async (category = logCategory) => {
        setLoadingLogs(true);
        try {
            const [sitemapRes, reportingRes, systemRes] = await Promise.all([
                fetch("/api/admin/sitemap/logs?category=sitemap"),
                fetch("/api/admin/sitemap/logs?category=reporting"),
                fetch("/api/admin/sitemap/logs?category=system")
            ]);
            if (sitemapRes.ok) {
                const d = await sitemapRes.json();
                setLogs(d.logs || []);
            }
            if (reportingRes.ok) {
                const d = await reportingRes.json();
                setReportingLogs(d.logs || []);
            }
            if (systemRes.ok) {
                const d = await systemRes.json();
                setSystemLogs(d.logs || []);
            }
        } catch (err) {
            console.error("[LOGS] Fetch error:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    // Fetch logs on first mount only (no interval polling)
    useEffect(() => {
        fetchLogs();
    }, []);

    // Re-fetch logs every time the user switches to the Logs tab
    useEffect(() => {
        if (activeTab === "logs") {
            fetchLogs();
        }
    }, [activeTab]);

    const handleSaveToggle = async (field, value) => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
            });
            if (res.ok) {
                setSettings(prev => ({ ...prev, [field]: value }));
                const label = field.toLowerCase().includes("reporting") ? "Reporting" : "Sitemap Automation";
                setMessage({ type: "success", text: `${label} is now ${value ? 'Enabled' : 'Disabled'}.` });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Failed to update status" });
        } finally {
            setSaving(false);
        }
    };

    const handleTimeChange = (type, val) => {
        const refTime = settings.sitemapReferenceTime || "00:00";
        const parts = refTime.split(":");
        let h24 = parseInt(parts[0], 10) || 0;
        let m = parseInt(parts[1], 10) || 0;
        let ampm = h24 >= 12 ? "PM" : "AM";
        
        if (type === 'hour') {
            const h = parseInt(val, 10);
            h24 = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
        } else if (type === 'minute') {
            m = parseInt(val, 10);
        } else if (type === 'ampm') {
            ampm = val;
            if (ampm === "PM" && h24 < 12) h24 += 12;
            if (ampm === "AM" && h24 >= 12) h24 -= 12;
        }
        
        const hh = String(h24).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        setSettings({...settings, sitemapReferenceTime: `${hh}:${mm}`});
    };

    const parsedTime = (() => {
        const refTime = settings.sitemapReferenceTime || "00:00";
        const parts = refTime.split(":");
        let h24 = parseInt(parts[0], 10) || 0;
        let m = parseInt(parts[1], 10) || 0;
        let ampm = h24 >= 12 ? "PM" : "AM";
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        return { hour: String(h12), minute: String(m).padStart(2, '0'), ampm };
    })();

    const handleSaveConfig = async (mode = "reporting") => {
        setMessage({ type: "", text: "" });
        const prefix = mode === "sitemap" ? "sitemap" : "reporting";
        const intervalField = `${prefix}Interval`;
        const refTimeField = `${prefix}ReferenceTime`;

        if (settings[intervalField] !== "5_MINS" && !settings[refTimeField]) {
            setMessage({ type: "error", text: "Reference time is required for day-based intervals." });
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setSaving(true);
        try {
            const updatePayload = {
                [intervalField]: settings[intervalField],
                [refTimeField]: settings[refTimeField]
            };

            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
            });

            if (res.ok) {
                setMessage({ type: "success", text: `${mode === "sitemap" ? "Sitemap" : "Reporting"} configuration updated! Next run recalculated.` });
                await fetchSettings();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const errorData = await res.json();
                setMessage({ type: "error", text: errorData.error || "Failed to update configuration" });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (e) {
            setMessage({ type: "error", text: "Network error while saving" });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSaving(false);
        }
    };

    const handleSendBatchNow = async () => {
        if (!confirmSendBatch) {
            setConfirmSendBatch(true);
            setTimeout(() => setConfirmSendBatch(false), 5000);
            return;
        }

        setConfirmSendBatch(false);
        setSendingBatch(true);
        try {
            const res = await fetch("/api/admin/sitemap/send-batch", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "Consolidated report sent successfully!" });
                setQueue([]);
                fetchSettings();
            } else {
                setMessage({ type: "error", text: data.error || "Failed to send batch" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Failed to connect to server" });
        } finally {
            setSendingBatch(false);
        }
    };

    const handleRemoveFromQueue = async (id) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            setTimeout(() => setConfirmDeleteId(null), 5000);
            return;
        }

        setConfirmDeleteId(null);
        setDeletingIds(prev => new Set(prev).add(id));
        try {
            const res = await fetch(`/api/admin/sitemap/queue/${id}`, { method: "DELETE" });
            if (res.ok) {
                setQueue(prev => prev.filter(item => item._id !== id));
                setMessage({ type: "success", text: "Sitemap removed from queue." });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Failed to remove item" });
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleCancelBatch = async () => {
        if (!confirmCancelBatch) {
            setConfirmCancelBatch(true);
            setTimeout(() => setConfirmCancelBatch(false), 5000);
            return;
        }

        setConfirmCancelBatch(false);
        setIsClearingQueue(true);
        try {
            const res = await fetch("/api/admin/sitemap/queue", { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: "Dispatch queue cancelled and cleared successfully." });
                setQueue([]);
                fetchSettings();
            } else {
                setMessage({ type: "error", text: data.error || "Failed to clear queue" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Failed to connect to server" });
        } finally {
            setIsClearingQueue(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Sitemap Automation</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage automated reporting cycles and dispatch queue.</p>
                </div>
            </div>

            {message.text && (
                <Alert variant={message.type === "success" ? "default" : "destructive"}>
                    {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="dashboard" onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 h-11 p-1 shadow-sm">
                    <TabsTrigger value="dashboard" className="px-6 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 font-bold">
                        <Calendar className="h-4 w-4 mr-2" />
                        Live Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="scheduler" className="px-6 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 font-bold">
                        <Zap className="h-4 w-4 mr-2 text-emerald-500" />
                        Sitemap Automation Settings
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="px-6 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 font-bold group">
                        <HistoryIcon className="h-4 w-4 mr-2 group-data-[state=active]:text-blue-600 transition-colors" />
                        Activity Logs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                        {/* Unified Scheduler Control Card */}
                        <Card className="border-zinc-200 shadow-sm overflow-hidden bg-white">
                            <CardHeader className="pb-3 border-b border-zinc-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
                                        <Zap className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-md font-bold text-zinc-900">Scheduler Control</CardTitle>
                                        <CardDescription className="text-xs text-zinc-500">Manage automated sitemap submission and email reporting.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {/* Shared Schedule Info Bar */}
                                <div className="flex flex-col gap-2 px-5 py-3 bg-zinc-50/70 border-b border-zinc-100 text-[11px] sm:text-xs">
                                     {/* Row 1: Left and Right */}
                                     <div className="flex items-center justify-between w-full">
                                         <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                                             <Clock3 className="h-3 w-3" />
                                             <span>Interval:</span>
                                             <span className="font-bold text-zinc-800">
                                                 {settings.sitemapInterval === "5_MINS" ? "Every 5 Minutes" : `Every ${settings.sitemapInterval?.split('_')[0] || 14} Days`}
                                             </span>
                                         </div>
                                         <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                                             <span>Last Run:</span>
                                             <span className="font-bold text-zinc-800">{settings.sitemapLastRunDate ? new Date(settings.sitemapLastRunDate).toLocaleDateString() : "Never"}</span>
                                         </div>
                                     </div>
                                     
                                     {/* Row 2: Center */}
                                     <div className="flex items-center justify-center w-full">
                                         <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
                                             <span>Next Run:</span>
                                             <span className="font-bold text-blue-600 italic tabular-nums">
                                                 {settings.sitemapNextRunDate
                                                     ? (new Date(settings.sitemapNextRunDate) <= new Date()
                                                         ? "No Scheduled Runs"
                                                         : new Date(settings.sitemapNextRunDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }))
                                                     : "No Scheduled Runs"}
                                             </span>
                                         </div>
                                     </div>
                                </div>

                                {/* Toggle Row 1: Sitemap Automation */}
                                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-emerald-50 rounded-md">
                                            <Zap className="h-3.5 w-3.5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-zinc-800">Sitemap Automation</p>
                                            <p className="text-[11px] text-zinc-400">Automatically re-submits all sitemaps to Google Search Console.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-wider",
                                            settings.sitemapBatchingEnabled ? "text-emerald-600" : "text-zinc-400"
                                        )}>
                                            {settings.sitemapBatchingEnabled ? "ON" : "OFF"}
                                        </span>
                                        <div
                                            className={cn(
                                                "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 shadow-sm flex-shrink-0",
                                                settings.sitemapBatchingEnabled ? "bg-emerald-500" : "bg-zinc-300"
                                            )}
                                            onClick={() => handleSaveToggle("sitemapBatchingEnabled", !settings.sitemapBatchingEnabled)}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm",
                                                settings.sitemapBatchingEnabled ? "translate-x-6" : "translate-x-0"
                                            )} />
                                        </div>
                                    </div>
                                </div>

                                {/* Toggle Row 2: Schedule Reporting */}
                                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-indigo-50 rounded-md">
                                            <Clock3 className="h-3.5 w-3.5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-zinc-800">Schedule Reporting</p>
                                            <p className="text-[11px] text-zinc-400">Automatically sends health-check email reports on the same schedule.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-wider",
                                            settings.reportingEnabled ? "text-indigo-600" : "text-zinc-400"
                                        )}>
                                            {settings.reportingEnabled ? "ON" : "OFF"}
                                        </span>
                                        <div
                                            className={cn(
                                                "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 shadow-sm flex-shrink-0",
                                                settings.reportingEnabled ? "bg-indigo-500" : "bg-zinc-300"
                                            )}
                                            onClick={() => handleSaveToggle("reportingEnabled", !settings.reportingEnabled)}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm",
                                                settings.reportingEnabled ? "translate-x-6" : "translate-x-0"
                                            )} />
                                        </div>
                                    </div>
                                </div>

                                {/* Send Batch Now */}
                                <div className="px-5 py-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-xs font-bold text-zinc-700">Manual Dispatch</p>
                                            <p className="text-[11px] text-zinc-400">{queue.length} item{queue.length !== 1 ? 's' : ''} in queue ready to send.</p>
                                        </div>
                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-bold text-[10px]">
                                            {queue.length} Pending
                                        </Badge>
                                    </div>
                                    <Button
                                        onClick={handleSendBatchNow}
                                        disabled={sendingBatch || queue.length === 0 || isProcessing}
                                        variant={confirmSendBatch ? "destructive" : "outline"}
                                        className={cn(
                                            "w-full font-bold h-10 transition-all active:scale-95",
                                            confirmSendBatch ? "bg-red-600 hover:bg-red-700 text-white border-transparent" : "border-zinc-200 hover:bg-zinc-50"
                                        )}
                                    >
                                        {sendingBatch ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : confirmSendBatch ? (
                                            <AlertCircle className="h-4 w-4 mr-2" />
                                        ) : (
                                            <Send className="h-4 w-4 mr-2" />
                                        )}
                                        {confirmSendBatch ? "Confirm Dispatch?" : `Send Batch Now (${queue.length})`}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Row 2: Queue Table Full Width */}
                        <div className="w-full">
                            <Card className="border-zinc-200 shadow-sm flex flex-col h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 py-0 border-none">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <ListTodo className="h-5 w-5 text-orange-500" />
                                            Dispatch Queue
                                        </CardTitle>
                                        <CardDescription>Waitlist of sitemaps pending for the next report.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {queue.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCancelBatch}
                                                disabled={isClearingQueue || sendingBatch}
                                                className={cn(
                                                    "h-8 text-[11px] font-bold transition-all",
                                                    confirmCancelBatch 
                                                        ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" 
                                                        : "text-zinc-500 hover:text-zinc-900 border-zinc-200"
                                                )}
                                            >
                                                {isClearingQueue ? (
                                                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                                ) : confirmCancelBatch ? (
                                                    <AlertCircle className="h-3 w-3 mr-1.5" />
                                                ) : (
                                                    <X className="h-3 w-3 mr-1.5" />
                                                )}
                                                {confirmCancelBatch ? "Confirm Cancel?" : "Cancel to Send"}
                                            </Button>
                                        )}
                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-bold">
                                            {queue.length} Pending
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden px-4 py-0">
                                    {/* Post-automation pending countdown */}
                                    {settings.reportingPostAutomationRunDate && queue.length > 0 && (
                                        <div className="mt-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-2 text-[12px] font-bold text-blue-700 animate-in fade-in">
                                            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                                            Post-automation report scheduled — dispatching in ~5 minutes after automation completed.
                                        </div>
                                    )}
                                    {/* Toggle off warning */}
                                    {!settings.reportingEnabled && queue.length > 0 && (
                                        <div className="mt-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100 flex items-center gap-2 text-[12px] font-bold text-orange-700 animate-in fade-in">
                                            <span className="shrink-0">⚠️</span>
                                            Schedule Reporting is disabled. {queue.length} item{queue.length !== 1 ? "s" : ""} are queued and waiting. Enable Schedule Reporting to trigger automatic dispatch.
                                        </div>
                                    )}
                                    <div className="rounded-lg border border-zinc-100 mt-2 max-h-[360px] overflow-y-auto overflow-x-auto">
                                        <table className="w-full text-sm min-w-[600px]">
                                            <thead className="bg-zinc-50 border-b border-zinc-100 sticky top-0 z-10">
                                                <tr>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Sitemap URL</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">User Email</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Status</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Errors</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Submitted</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100">
                                                {queue.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" className="py-12 text-center text-zinc-400 font-medium italic">
                                                            No submissions currently in queue.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    queue.map((item) => (
                                                        <tr key={item._id} className="hover:bg-zinc-50/50 transition-colors">
                                                            <td className="py-3 px-4 text-zinc-900 font-bold truncate max-w-[250px]">{item.sitemapUrl}</td>
                                                            <td className="py-3 px-4 text-zinc-500 text-xs font-medium truncate max-w-[200px]">{item.userEmail || <span className="italic text-zinc-400">System</span>}</td>
                                                            <td className="py-3 px-4">
                                                                <span className={cn(
                                                                    "px-2 px-1 text-[10px] font-bold uppercase rounded flex items-center justify-center w-fit gap-1",
                                                                    settings.reportingEnabled 
                                                                        ? "bg-blue-50 text-blue-600 border border-blue-100" 
                                                                        : "bg-orange-50 text-orange-600 border border-orange-100"
                                                                )}>
                                                                    {settings.reportingEnabled ? (
                                                                        <>
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                                                            Queued
                                                                        </>
                                                                    ) : "Waiting to send"}
                                                                </span>
                                                            </td>
                                                            <td className={cn("py-3 px-4 text-xs font-bold", item.errorCount > 0 ? "text-red-600" : "text-emerald-600")}>
                                                                {item.errorCount || 0}
                                                            </td>
                                                            <td className="py-3 px-4 text-zinc-500 text-xs">{new Date(item.submittedAt).toLocaleDateString()}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>


                <TabsContent value="scheduler">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-emerald-600" />
                                    Sitemap Automation Settings
                                </CardTitle>
                                <CardDescription>Configure how sitemap automation runs and dispatch cycles.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-zinc-700 block text-emerald-600">Wait Period (Interval)</label>
                                        <Select
                                            value={settings.sitemapInterval || "14_DAYS"}
                                            onValueChange={(val) => setSettings({ ...settings, sitemapInterval: val })}
                                        >
                                            <SelectTrigger className="w-full h-11 border-zinc-200 font-bold text-zinc-900 bg-white shadow-sm">
                                                <SelectValue placeholder="Select frequency" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-zinc-200 shadow-xl overflow-hidden rounded-xl">
                                                <SelectItem value="5_MINS" className="py-3 font-bold text-zinc-700 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer">5 Minutes (Instant Test)</SelectItem>
                                                <SelectItem value="1_DAY" className="py-3 font-bold text-zinc-700 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer">1 Day (Daily)</SelectItem>
                                                <SelectItem value="7_DAYS" className="py-3 font-bold text-zinc-700 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer">7 Days</SelectItem>
                                                <SelectItem value="14_DAYS" className="py-3 font-bold text-zinc-700 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer">14 Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-zinc-400 italic">This will re-submit your master sitemap list to Google at the chosen interval.</p>
                                        {(settings.sitemapInterval === "7_DAYS" || settings.sitemapInterval === "14_DAYS") && (
                                            <p className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1.5 rounded border border-blue-100 flex items-center gap-1.5 animate-in fade-in">
                                                <Info className="h-3 w-3" />
                                                For 7 and 14-day intervals, runs are mathematically scheduled on Fridays only.
                                            </p>
                                        )}
                                    </div>

                                    {settings.sitemapInterval !== "5_MINS" && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-sm font-bold text-zinc-700 block text-emerald-600">Preferred Dispatch Time</label>
                                            <div className="flex items-center gap-2">
                                                {/* Hour Select */}
                                                <Select value={parsedTime.hour} onValueChange={(val) => handleTimeChange('hour', val)}>
                                                    <SelectTrigger className="w-[80px] h-11 border-zinc-200 font-bold text-zinc-900 bg-white">
                                                        <SelectValue placeholder="HH" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white max-h-[200px]">
                                                        {Array.from({length: 12}, (_, i) => String(i + 1)).map(h => (
                                                            <SelectItem key={h} value={h} className="font-bold cursor-pointer">{h.padStart(2, '0')}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                
                                                <span className="font-bold text-zinc-400">:</span>
                                                
                                                {/* Minute Select */}
                                                <Select value={parsedTime.minute} onValueChange={(val) => handleTimeChange('minute', val)}>
                                                    <SelectTrigger className="w-[80px] h-11 border-zinc-200 font-bold text-zinc-900 bg-white">
                                                        <SelectValue placeholder="MM" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white max-h-[200px]">
                                                        {["00", "15", "30", "45"].map(m => (
                                                            <SelectItem key={m} value={m} className="font-bold cursor-pointer">{m}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                {/* AM/PM Select */}
                                                <Select value={parsedTime.ampm} onValueChange={(val) => handleTimeChange('ampm', val)}>
                                                    <SelectTrigger className="w-[80px] h-11 border-zinc-200 font-bold text-zinc-900 bg-white">
                                                        <SelectValue placeholder="AM/PM" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white">
                                                        <SelectItem value="AM" className="font-bold cursor-pointer">AM</SelectItem>
                                                        <SelectItem value="PM" className="font-bold cursor-pointer">PM</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                
                                                <div className="flex-1 text-right">
                                                    <Clock3 className="inline-block h-4 w-4 text-emerald-500 opacity-60" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Button
                                        onClick={() => handleSaveConfig("sitemap")}
                                        disabled={saving || !settings.sitemapBatchingEnabled}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 shadow-sm transition-all active:scale-95 disabled:bg-zinc-300 disabled:opacity-70"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                                        Save & Run Sitemap Automation
                                    </Button>
                                    {!settings.sitemapBatchingEnabled && (
                                        <p className="text-[11px] text-red-500 text-center font-bold animate-in fade-in">
                                            ⚠️ Enable Automation in the Live Dashboard to access this action.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-zinc-200 shadow-sm bg-white">
                            <CardHeader>
                                <CardTitle className="text-md font-bold text-zinc-900 flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-zinc-900" />
                                    Automation Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-lg space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-600">Last Run</span>
                                        <span className="text-xs font-medium tabular-nums text-zinc-500 text-right">
                                            {settings.sitemapLastRunDate ? new Date(settings.sitemapLastRunDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Never"}
                                        </span>
                                    </div>
                                    <div className="h-px bg-zinc-200" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-600">Target Next Run</span>
                                        <div className="flex flex-col items-end">
                                            <Badge variant="outline" className={cn(
                                                "px-2 py-0 h-4 border-none font-bold mb-1",
                                                settings.sitemapBatchingEnabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"
                                            )}>
                                                {settings.sitemapBatchingEnabled ? "ACTIVE" : "PAUSED"}
                                            </Badge>
                                            <span className="text-xs font-medium tabular-nums text-zinc-900">
                                                {settings.sitemapNextRunDate
                                                    ? (new Date(settings.sitemapNextRunDate) <= new Date()
                                                        ? "No Scheduled Runs"
                                                        : new Date(settings.sitemapNextRunDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }))
                                                    : "No Scheduled Runs"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                                <HistoryIcon className="h-4 w-4 text-blue-600" />
                                Activity Logs
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">Latest 20 entries per scheduler.</p>
                        </div>
                        <button
                            onClick={fetchLogs}
                            disabled={loadingLogs}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-1.5 bg-white hover:bg-zinc-50 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <RotateCcw className={cn("h-3 w-3", loadingLogs && "animate-spin")} />
                            Refresh
                        </button>
                    </div>

                    {/* Category Toggle */}
                    <div className="inline-flex bg-zinc-100 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setLogCategory("sitemap")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer",
                                logCategory === "sitemap"
                                    ? "bg-white text-emerald-700 shadow-sm border border-zinc-200"
                                    : "text-zinc-500 hover:text-zinc-800"
                            )}
                        >
                            <Zap className="h-3.5 w-3.5" />
                            Sitemap Automation
                            <Badge variant="outline" className={cn(
                                "ml-1 px-1.5 py-0 h-4 text-[9px] font-black border-none",
                                logCategory === "sitemap" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-500"
                            )}>
                                {logs.length}
                            </Badge>
                        </button>
                        <button
                            onClick={() => setLogCategory("reporting")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer",
                                logCategory === "reporting"
                                    ? "bg-white text-indigo-700 shadow-sm border border-zinc-200"
                                    : "text-zinc-500 hover:text-zinc-800"
                            )}
                        >
                            <Clock3 className="h-3.5 w-3.5" />
                            Reporting Scheduler
                            <Badge variant="outline" className={cn(
                                "ml-1 px-1.5 py-0 h-4 text-[9px] font-black border-none",
                                logCategory === "reporting" ? "bg-indigo-100 text-indigo-700" : "bg-zinc-200 text-zinc-500"
                            )}>
                                {reportingLogs.length}
                            </Badge>
                        </button>
                        <button
                            onClick={() => setLogCategory("system")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer",
                                logCategory === "system"
                                    ? "bg-white text-amber-700 shadow-sm border border-zinc-200"
                                    : "text-zinc-500 hover:text-zinc-800"
                            )}
                        >
                            <AlertCircle className="h-3.5 w-3.5" />
                            System Logs
                            <Badge variant="outline" className={cn(
                                "ml-1 px-1.5 py-0 h-4 text-[9px] font-black border-none",
                                logCategory === "system" ? "bg-amber-100 text-amber-700" : "bg-zinc-200 text-zinc-500"
                            )}>
                                {systemLogs.length}
                            </Badge>
                        </button>
                    </div>

                    {/* Log List */}
                    {(() => {
                        const activeLogs = logCategory === "sitemap" ? logs : logCategory === "reporting" ? reportingLogs : systemLogs;
                        const accentColor = logCategory === "sitemap" ? "emerald" : logCategory === "reporting" ? "indigo" : "amber";

                        if (loadingLogs && activeLogs.length === 0) {
                            return (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
                                </div>
                            );
                        }

                        if (activeLogs.length === 0) {
                            return (
                                <div className="py-16 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                                    <HistoryIcon className="h-10 w-10 text-zinc-200 mx-auto mb-3" />
                                    <p className="text-zinc-400 font-medium text-sm">No {logCategory === "sitemap" ? "Sitemap Automation" : logCategory === "reporting" ? "Reporting Scheduler" : "System"} logs yet.</p>
                                    <p className="text-zinc-300 text-xs mt-1">Logs appear automatically after the first execution cycle.</p>
                                </div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {activeLogs.map((log, idx) => {
                                    const isInfo = log.status === "INFO";
                                    const isError = log.status === "ERROR";
                                    const isSuccess = log.status === "SUCCESS";

                                    const statusColor = isError
                                        ? "text-rose-600 bg-rose-50 border-rose-100"
                                        : isSuccess
                                            ? `text-${accentColor}-700 bg-${accentColor}-50 border-${accentColor}-100`
                                            : "text-blue-600 bg-blue-50 border-blue-100";

                                    const statusLabel = isError ? "ERROR" : isSuccess ? "SUCCESS" : "TRACE";

                                    const dotColor = isError ? "bg-rose-400" : isSuccess
                                        ? (accentColor === "emerald" ? "bg-emerald-400" : "bg-indigo-400")
                                        : "bg-blue-400";

                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-3 p-3.5 bg-white border border-zinc-100 rounded-xl hover:border-zinc-200 hover:shadow-sm transition-all duration-200 animate-in slide-in-from-bottom-1 h-full"
                                            style={{ animationDelay: `${idx * 20}ms` }}
                                        >
                                            {/* Status dot */}
                                            <div className="mt-1 flex-shrink-0">
                                                <div className={cn("w-2 h-2 rounded-full mt-0.5", dotColor)} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-semibold text-zinc-700 leading-relaxed break-words">
                                                    {log.message}
                                                </p>
                                                {/* Summary line for SUCCESS/ERROR logs */}
                                                {!isInfo && log.itemCount > 0 && (
                                                    <div className="mt-1.5 flex flex-wrap gap-2">
                                                        <span className="text-[10px] font-bold text-zinc-400">
                                                            {log.itemCount} item{log.itemCount !== 1 ? 's' : ''} processed
                                                        </span>
                                                        {log.items?.some(i => i.healthStatus === "ERROR") && (
                                                            <span className="text-[10px] font-bold text-rose-500">
                                                                {log.items.filter(i => i.healthStatus === "ERROR").length} failed
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right side: time + badge */}
                                            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                                                <Badge variant="outline" className={cn("text-[8px] px-1.5 h-4 font-black uppercase border", statusColor)}>
                                                    {statusLabel}
                                                </Badge>
                                                <span className="text-[9px] text-zinc-400 tabular-nums whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                                <span className="text-[9px] text-zinc-300 tabular-nums">
                                                    {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </TabsContent>
            </Tabs>
        </div>
    );
}
