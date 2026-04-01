"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon, Upload, Globe, Image as ImageIcon, Check, Loader2, Save, Mail, Server, Key, User, Zap, ShieldCheck, FileText, Calendar, ListTodo, History, Send, Clock3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FaviconCropModal } from "@/components/admin/favicon-crop-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function AdminSettingsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [settings, setSettings] = useState({
        siteTitle: "",
        logoUrl: "",
        faviconUrl: "",
        logoWidth: "",
        logoHeight: "",
        emailProvider: "EmailJS",
        brevoApiKey: "",
        senderEmail: "",
        emailjsServiceId: "",
        emailjsTemplateId: "",
        emailjsTemplateIdSuccess: "",
        emailjsTemplateIdFailed: "",
        emailjsPrivateKey: "",
        sitemapBatchingEnabled: true,
        sitemapLastRunDate: null,
        nextRunDate: null,
        notificationEmail: "",
    });
    const [queue, setQueue] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [sendingBatch, setSendingBatch] = useState(false);
    const [activeTab, setActiveTab] = useState("general");
    const [confirmSendBatch, setConfirmSendBatch] = useState(false);
    const [loading, setLoading] = useState(true);
    const [emailError, setEmailError] = useState(false);
    const [savedProvider, setSavedProvider] = useState("EmailJS");
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [deletingItems, setDeletingIds] = useState(new Set());
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [tempFaviconSrc, setTempFaviconSrc] = useState(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    setSettings({
                        ...data,
                        logoWidth: data.logoWidth || "",
                        logoHeight: data.logoHeight || "",

                        emailProvider: data.emailProvider || "EmailJS",
                        brevoApiKey: data.brevoApiKey || "",
                        senderEmail: data.senderEmail || "",
                        emailjsServiceId: data.emailjsServiceId || "",
                        emailjsTemplateId: data.emailjsTemplateId || "",
                        emailjsTemplateIdSuccess: data.emailjsTemplateIdSuccess || "",
                        emailjsTemplateIdFailed: data.emailjsTemplateIdFailed || "",
                        emailjsPublicKey: data.emailjsPublicKey || "",
                        emailjsPrivateKey: data.emailjsPrivateKey || "",
                        notificationEmail: data.notificationEmail || "",
                    });
                    setSavedProvider(data.emailProvider || "EmailJS");

                }
            } catch (error) {
                console.error("Failed to fetch settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const fetchSitemapData = async () => {
            const isActive = isProcessing || settings.isProcessing;
            const startTime = Date.now();

            try {
                // 1. Fetch Queue
                const queueRes = await fetch("/api/admin/sitemap/queue");
                if (queueRes.ok) {
                    const queueData = await queueRes.json();
                    if (queueData.items) {
                        setQueue(queueData.items);
                        setIsProcessing(queueData.isProcessing);
                        console.log(`[SCHEDULER-DEBUG] Queue Fetched: ${queueData.items.length} items. isProcessing: ${queueData.isProcessing}`);
                    }
                }

                // 2. Fetch Settings
                const settingsRes = await fetch("/api/settings");
                if (settingsRes.ok) {
                    const settingsData = await settingsRes.json();
                    setSettings(prev => ({
                        ...prev,
                        ...settingsData,
                        logoWidth: settingsData.logoWidth || "",
                        logoHeight: settingsData.logoHeight || ""
                    }));
                    console.log(`[SCHEDULER-DEBUG] Settings Fetched. nextRunDate: ${settingsData.nextRunDate}. Latency: ${Date.now() - startTime}ms`);
                }

                // 3. Fetch Logs
                const logsRes = await fetch("/api/admin/sitemap/logs");
                if (logsRes.ok) {
                    const logsData = await logsRes.json();
                    if (logsData.logs) {
                        setLogs(logsData.logs);
                    }
                }
            } catch (error) {
                console.error("[SCHEDULER-DEBUG] Fetch error:", error);
            } finally {
                setLoadingQueue(false);
            }
        };

        if (activeTab === "sitemap-scheduler") {
            const intervalDuration = (isProcessing || settings.isProcessing) ? 3000 : 30000;
            console.log(`[SCHEDULER-DEBUG] Starting polling cycle. Interval: ${intervalDuration}ms. activeTab: ${activeTab}`);
            fetchSitemapData();
            const interval = setInterval(fetchSitemapData, intervalDuration);
            return () => clearInterval(interval);
        }
    }, [activeTab, isProcessing, settings.isProcessing]);

    // Sync browser tab branding in real-time
    useEffect(() => {
        if (!loading) {
            if (settings.siteTitle) document.title = settings.siteTitle;
            if (settings.faviconUrl) {
                let link = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = settings.faviconUrl;
            }
        }
    }, [settings.siteTitle, settings.faviconUrl, loading]);

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith("image/")) {
            setMessage({ type: "error", text: "Please upload an image files" });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target.result;

            if (field === "faviconUrl") {
                // For favicon, we open the crop modal
                setTempFaviconSrc(result);
                // Check if it's already 32x32 (approximate check via Image)
                const img = new Image();
                img.onload = () => {
                    if (img.width === 32 && img.height === 32) {
                        // Exactly 32x32, we can skip and just set
                        setSettings(prev => ({ ...prev, [field]: result }));
                    } else {
                        setCropModalOpen(true);
                    }
                };
                img.src = result;
            } else {
                setSettings(prev => ({ ...prev, [field]: result }));
            }

            // Reset input so same file can be re-selected if needed
            e.target.value = "";
        };
        reader.readAsDataURL(file);
    };

    const handleSaveBranding = async () => {
        setSaving(true);
        setMessage({ type: "", text: "" });

        const siteTitle = settings.siteTitle?.trim() || "GSC Dashboard";
        const logoWidth = settings.logoWidth ? Math.max(1, parseInt(settings.logoWidth)) : "";
        const logoHeight = settings.logoHeight ? Math.max(1, parseInt(settings.logoHeight)) : "";

        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    siteTitle,
                    logoUrl: settings.logoUrl,
                    faviconUrl: settings.faviconUrl,
                    logoWidth,
                    logoHeight,
                }),
            });
            if (res.ok) {
                router.refresh();
                setMessage({ type: "success", text: "Branding settings saved successfully!" });
                setSettings(prev => ({ ...prev, siteTitle, logoWidth, logoHeight }));
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to save branding" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Something went wrong" });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveScheduler = async (batchingState = null) => {
        setSaving(true);
        setMessage({ type: "", text: "" });

        const isBatchingEnabled = batchingState !== null ? batchingState : settings.sitemapBatchingEnabled;

        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sitemapBatchingEnabled: isBatchingEnabled,
                }),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Scheduler settings saved successfully!" });
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to save scheduler config" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Something went wrong" });
        } finally {
            setSaving(false);
        }
    };

    const handleSendBatchNow = async () => {
        if (!confirmSendBatch) {
            setConfirmSendBatch(true);
            // Reset after 5 seconds of inactivity
            setTimeout(() => {
                setConfirmSendBatch(prev => prev ? false : prev);
            }, 5000);
            return;
        }

        setConfirmSendBatch(false);
        setSendingBatch(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch("/api/admin/sitemap/send-batch", { method: "POST" });
            const data = await res.json();

            if (res.ok) {
                const sentTime = data.sentAt ? new Date(data.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString();
                setMessage({
                    type: "success",
                    text: `Consolidated report sent successfully! Dispatch confirmed on ${sentTime}.`
                });
                setQueue([]); // Clear queue locally
                setSettings(prev => ({ ...prev, sitemapLastRunDate: new Date() }));
            } else {
                setMessage({ type: "error", text: data.error || "Failed to send batch" });
            }
        } catch (error) {
            console.error("sendBatch error:", error);
            setMessage({ type: "error", text: "Failed to connect to server or invalid response" });
        } finally {
            setSendingBatch(false);
        }
    };

    const handleRemoveFromQueue = async (id) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            // Reset confirmation after 5 seconds of inactivity
            setTimeout(() => {
                setConfirmDeleteId(prev => prev === id ? null : prev);
            }, 5000);
            return;
        }

        setConfirmDeleteId(null);
        setDeletingIds(prev => new Set(prev).add(id));
        try {
            const res = await fetch(`/api/admin/sitemap/queue/${id}`, { method: "DELETE" });
            if (res.ok) {
                setQueue(prev => prev.filter(item => item._id !== id));
                setMessage({ type: "success", text: "Sitemap removed from queue successfully!" });
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to remove item" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Failed to connect to server" });
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleSaveEmail = async () => {
        if (!settings.notificationEmail?.trim()) {
            setMessage({ type: "error", text: "Notification Recipient Email is required." });
            setEmailError(true);
            return;
        }

        setEmailError(false);
        setSaving(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emailProvider: settings.emailProvider,
                    brevoApiKey: settings.brevoApiKey,
                    senderEmail: settings.senderEmail,
                    emailjsServiceId: settings.emailjsServiceId,
                    emailjsTemplateId: settings.emailjsTemplateId,
                    emailjsTemplateIdSuccess: settings.emailjsTemplateIdSuccess,
                    emailjsTemplateIdFailed: settings.emailjsTemplateIdFailed,
                    emailjsPublicKey: settings.emailjsPublicKey,
                    emailjsPrivateKey: settings.emailjsPrivateKey,
                    notificationEmail: settings.notificationEmail,
                }),

            });
            if (res.ok) {
                setMessage({ type: "success", text: "Email configuration saved successfully!" });
                setSavedProvider(settings.emailProvider);
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to save email config" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Something went wrong" });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!settings.notificationEmail?.trim()) {
            setMessage({ type: "error", text: "Notification Recipient Email is required to send a test." });
            setEmailError(true);
            return;
        }

        setEmailError(false);
        setTesting(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch("/api/settings/test-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emailProvider: settings.emailProvider,
                    brevoApiKey: settings.brevoApiKey,
                    senderEmail: settings.senderEmail,
                    emailjsServiceId: settings.emailjsServiceId,
                    emailjsTemplateId: settings.emailjsTemplateId,
                    emailjsTemplateIdSuccess: settings.emailjsTemplateIdSuccess,
                    emailjsTemplateIdFailed: settings.emailjsTemplateIdFailed,
                    emailjsPublicKey: settings.emailjsPublicKey,
                    emailjsPrivateKey: settings.emailjsPrivateKey,
                    notificationEmail: settings.notificationEmail,
                    siteTitle: settings.siteTitle
                }),

            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: "success", text: data.message });
            } else {
                setMessage({ type: "error", text: data.error || "Connection test failed" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Failed to test connection" });
        } finally {
            setTesting(false);
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
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Admin Settings</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage global branding and email notifications.</p>
                </div>
                {activeTab !== "sitemap-scheduler" && (
                    <Button
                        onClick={activeTab === "general" ? handleSaveBranding : handleSaveEmail}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-100 transition-all active:scale-95 px-8"
                    >
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {activeTab === "general" ? "Save Branding" : "Save Email Config"}
                    </Button>
                )}
            </div>

            {message.text && (
                <Alert variant={message.type === "success" ? "default" : "destructive"} className={message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}>
                    {message.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="general" onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 h-11 p-1 shadow-sm">
                    <TabsTrigger value="general" className="px-6 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 font-bold">
                        <Globe className="h-4 w-4 mr-2" />
                        General Branding
                    </TabsTrigger>
                    <TabsTrigger value="email" className="px-6 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 font-bold">
                        <Mail className="h-4 w-4 mr-2" />
                        Email Configuration
                    </TabsTrigger>
                    <TabsTrigger value="sitemap-scheduler" className="px-6 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 font-bold">
                        <Calendar className="h-4 w-4 mr-2" />
                        Sitemap Scheduler
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Site Title */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Globe className="h-5 w-5 text-blue-500" />
                                    General Branding
                                </CardTitle>
                                <CardDescription>Update the site title that appears in the browser tab.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-700">Site Title</label>
                                    <Input
                                        value={settings.siteTitle}
                                        onChange={(e) => setSettings({ ...settings, siteTitle: e.target.value })}
                                        placeholder="e.g. My Custom Dashboard"
                                        className="border-zinc-200 focus:ring-emerald-500"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Browser Favicon */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <SettingsIcon className="h-5 w-5 text-orange-500" />
                                    Browser Favicon
                                </CardTitle>
                                <CardDescription>Small icon displayed in the browser tab.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-6 p-4 border border-zinc-100 rounded-lg bg-zinc-50/30">
                                    <div className="h-16 w-16 bg-white border border-zinc-200 rounded flex items-center justify-center shadow-sm relative group overflow-hidden">
                                        {settings.faviconUrl ? (
                                            <img
                                                key={settings.faviconUrl.slice(-10)} // Force re-render on value change
                                                src={settings.faviconUrl}
                                                alt="Favicon"
                                                className="h-10 w-10 object-contain"
                                            />
                                        ) : (
                                            <div className="h-10 w-10 bg-zinc-100 rounded" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-bold text-zinc-700 mb-2">Icon Branding</label>
                                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer shadow-sm">
                                            <Upload className="h-4 w-4" />
                                            {settings.faviconUrl ? 'Change Icon' : 'Upload Icon'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, "faviconUrl")}
                                            />
                                        </label>
                                        <p className="text-[10px] text-zinc-400 mt-2 italic font-medium">Recommended: 32x32px PNG/ICO</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dashboard Logo */}
                        < Card className="border-zinc-200 shadow-sm" >
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <ImageIcon className="h-5 w-5 text-purple-500" />
                                    Dashboard Logo
                                </CardTitle>
                                <CardDescription>Upload logo and set explicit dimensions (px).</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-100 rounded-xl bg-zinc-50/50 relative group">
                                    {settings.logoUrl ? (
                                        <div className="relative group">
                                            <img
                                                key={settings.logoUrl.slice(-10)}
                                                src={settings.logoUrl}
                                                alt="Logo Preview"
                                                style={{
                                                    maxWidth: '200px',
                                                    maxHeight: '60px',
                                                    objectFit: 'contain'
                                                }}
                                                className="transition-opacity group-hover:opacity-50"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <label className="cursor-pointer bg-white/90 px-3 py-1.5 rounded-full text-xs font-bold border border-zinc-200 flex items-center gap-2 shadow-sm">
                                                    <Upload className="h-3.5 w-3.5" />
                                                    Replace
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, "logoUrl")} />
                                                </label>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <ImageIcon className="h-10 w-10 text-zinc-200 mx-auto mb-2" />
                                            <label className="cursor-pointer text-emerald-600 font-bold hover:underline">
                                                Upload Logo
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, "logoUrl")} />
                                            </label>
                                            <p className="text-[11px] text-zinc-400 mt-1">Recommended: 160x40 (Transparent PNG)</p>
                                        </div>
                                    )}
                                </div>

                                {/* Dimensions Row */}
                                <div className="pt-4 border-t border-zinc-100">
                                    <label className="text-sm font-bold text-zinc-700 mb-3 block">Logo Dimensions (Width × Height)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <Input
                                                type="number"
                                                min="1"
                                                placeholder="Auto"
                                                value={settings.logoWidth}
                                                onChange={(e) => setSettings({ ...settings, logoWidth: e.target.value })}
                                                className="h-10 border-zinc-200 focus:ring-emerald-500 pr-8"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 uppercase">W</span>
                                        </div>
                                        <span className="text-zinc-300 font-bold">×</span>
                                        <div className="relative flex-1">
                                            <Input
                                                type="number"
                                                min="1"
                                                placeholder="Auto"
                                                value={settings.logoHeight}
                                                onChange={(e) => setSettings({ ...settings, logoHeight: e.target.value })}
                                                className="h-10 border-zinc-200 focus:ring-emerald-500 pr-8"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 uppercase">H</span>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 mt-2 italic font-medium">Leave blank for auto-resizing based on aspect ratio.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="email">
                    <Card className="border-zinc-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-zinc-50/50 border-bottom border-zinc-100">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Mail className="h-5 w-5 text-blue-600" />
                                        Email Configuration
                                    </CardTitle>
                                    <CardDescription>Select your provider and configure credentials.</CardDescription>
                                </div>
                                <div className="flex items-center bg-zinc-100/80 p-1 rounded-full border border-zinc-200/50 shadow-inner">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSettings({ ...settings, emailProvider: "EmailJS" })}
                                        className={cn(
                                            "relative px-6 h-8 text-xs font-bold transition-all rounded-full",
                                            settings.emailProvider === "EmailJS"
                                                ? "bg-white shadow-sm text-blue-600 ring-1 ring-zinc-200"
                                                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
                                        )}
                                    >
                                        EmailJS
                                        {savedProvider === "EmailJS" && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
                                            </span>
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSettings({ ...settings, emailProvider: "Brevo" })}
                                        className={cn(
                                            "relative px-6 h-8 text-xs font-bold transition-all rounded-full",
                                            settings.emailProvider === "Brevo"
                                                ? "bg-white shadow-sm text-blue-600 ring-1 ring-zinc-200"
                                                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
                                        )}
                                    >
                                        Brevo
                                        {savedProvider === "Brevo" && (
                                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {settings.emailProvider === "EmailJS" ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Zap className="h-3 w-3" /> Service ID
                                        </label>
                                        <Input
                                            value={settings.emailjsServiceId}
                                            onChange={(e) => setSettings({ ...settings, emailjsServiceId: e.target.value })}
                                            placeholder="service_..."
                                            className="h-10 border-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <FileText className="h-3 w-3 text-green-500" /> Passed Template ID
                                        </label>
                                        <Input
                                            value={settings.emailjsTemplateIdSuccess || ""}
                                            onChange={(e) => setSettings({ ...settings, emailjsTemplateIdSuccess: e.target.value })}
                                            placeholder="template_..."
                                            className="h-10 border-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <FileText className="h-3 w-3 text-red-500" /> Failed Template ID
                                        </label>
                                        <Input
                                            value={settings.emailjsTemplateIdFailed || ""}
                                            onChange={(e) => setSettings({ ...settings, emailjsTemplateIdFailed: e.target.value })}
                                            placeholder="template_..."
                                            className="h-10 border-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <ShieldCheck className="h-3 w-3" /> Public Key
                                        </label>
                                        <Input
                                            value={settings.emailjsPublicKey}
                                            onChange={(e) => setSettings({ ...settings, emailjsPublicKey: e.target.value })}
                                            placeholder="user_..."
                                            className="h-10 border-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Key className="h-3 w-3" /> Private Key (Optional)
                                        </label>
                                        <Input
                                            type="password"
                                            value={settings.emailjsPrivateKey}
                                            onChange={(e) => setSettings({ ...settings, emailjsPrivateKey: e.target.value })}
                                            placeholder="Access Token"
                                            className="h-10 border-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-blue-500" /> Notification Recipient Email <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            type="email"
                                            value={settings.notificationEmail}
                                            onChange={(e) => { setSettings({ ...settings, notificationEmail: e.target.value }); if (emailError) setEmailError(false); }}
                                            placeholder="admin@example.com"
                                            className={cn("h-10 transition-all", emailError ? "border-red-500 ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.5)]" : "border-zinc-200")}
                                        />
                                        <p className="text-[10px] text-zinc-400 italic">This is where consolidated sitemap reports will be sent.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <User className="h-3 w-3" /> Sender Email
                                        </label>
                                        <Input
                                            type="email"
                                            value={settings.senderEmail}
                                            onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
                                            placeholder="support@example.com"
                                            className="h-10 border-zinc-200"
                                        />
                                    </div>
                                    <div className="md:col-span-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                        <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                                            <strong>EmailJS template variables:</strong> <code>&#123;&#123;to_email&#125;&#125;</code>, <code>&#123;&#123;company_name&#125;&#125;</code>, <code>&#123;&#123;sitemap_url&#125;&#125;</code>, <code>&#123;&#123;error_rows&#125;&#125;</code>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Key className="h-3 w-3 text-orange-500" /> Brevo API Key
                                        </label>
                                        <Input
                                            type="password"
                                            value={settings.brevoApiKey}
                                            onChange={(e) => setSettings({ ...settings, brevoApiKey: e.target.value })}
                                            placeholder="xkeysib-..."
                                            className="h-10 border-zinc-200"
                                        />
                                        <p className="text-[10px] text-zinc-400 italic">Found in your Brevo Dashboard under SMTP & API Keys.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-blue-500" /> Notification Recipient Email <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            type="email"
                                            value={settings.notificationEmail}
                                            onChange={(e) => { setSettings({ ...settings, notificationEmail: e.target.value }); if (emailError) setEmailError(false); }}
                                            placeholder="admin@example.com"
                                            className={cn("h-10 transition-all", emailError ? "border-red-500 ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.5)]" : "border-zinc-200")}
                                        />
                                        <p className="text-[10px] text-zinc-400 italic">This is where consolidated sitemap reports will be sent.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <User className="h-3 w-3" /> Sender Email
                                        </label>
                                        <Input
                                            type="email"
                                            value={settings.senderEmail}
                                            onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
                                            placeholder="support@example.com"
                                            className="h-10 border-zinc-200"
                                        />
                                        <p className="text-[10px] text-zinc-400 italic">Important: Must be a verified sender in your Brevo account.</p>
                                    </div>
                                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                                            <strong>Brevo Support:</strong> We use direct API delivery with a professionally formatted HTML report. No template setup required in Brevo!
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 border-t border-zinc-100 flex gap-3">
                                <Button
                                    onClick={handleTestConnection}
                                    disabled={testing}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-sm transition-all active:scale-95"
                                >
                                    {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Server className="h-4 w-4 mr-2" />}
                                    Test {settings.emailProvider} Connection
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sitemap-scheduler" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Scheduler Controls */}
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="border-zinc-200 shadow-sm">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-emerald-600" />
                                            Scheduler
                                        </CardTitle>
                                        <div
                                            className={cn(
                                                "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200",
                                                settings.sitemapBatchingEnabled ? "bg-emerald-500" : "bg-zinc-300"
                                            )}
                                            onClick={() => {
                                                const newState = !settings.sitemapBatchingEnabled;
                                                setSettings({ ...settings, sitemapBatchingEnabled: newState });
                                                handleSaveScheduler(newState);
                                            }}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 bg-white rounded-full transition-transform duration-200",
                                                settings.sitemapBatchingEnabled ? "translate-x-6" : "translate-x-0"
                                            )} />
                                        </div>
                                    </div>
                                    <CardDescription>Bi-weekly report dispatch on Fridays at 6:00 PM IST.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-zinc-500 font-medium">Last Run Date</span>
                                            <span className="text-zinc-900 font-bold">{settings.sitemapLastRunDate ? new Date(settings.sitemapLastRunDate).toLocaleDateString() : "Never"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-zinc-500 font-medium">Schedule</span>
                                            <span className="text-emerald-700 font-bold">14-Day Friday Evening (6 PM IST)</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs border-t border-zinc-200 pt-3">
                                            <span className="text-zinc-500 font-medium flex items-center gap-1">
                                                <Clock3 className="h-3 w-3" /> Next Run
                                            </span>
                                            <span className="text-blue-600 font-bold italic">
                                                {settings.isProcessing
                                                    ? "Dispatching report..."
                                                    : settings.nextRunDate
                                                        ? (new Date(settings.nextRunDate) <= new Date()
                                                            ? "Pending Immediate Dispatch"
                                                            : `${new Date(settings.nextRunDate).toLocaleString('en-IN', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: 'numeric',
                                                                minute: '2-digit',
                                                                hour12: true
                                                            })} IST`)
                                                        : (queue.length > 0 ? "Waiting for 14-day Friday window..." : "Waiting for sitemaps...")}
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleSendBatchNow}
                                        disabled={sendingBatch || queue.length === 0 || settings.isProcessing}
                                        variant={confirmSendBatch ? "destructive" : "outline"}
                                        className={cn(
                                            "w-full font-bold h-10 transition-all active:scale-95",
                                            confirmSendBatch ? "bg-red-600 hover:bg-red-700 text-white border-transparent" : "border-zinc-200 hover:bg-zinc-50"
                                        )}
                                    >
                                        {(sendingBatch || isProcessing) ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : confirmSendBatch ? (
                                            <AlertCircle className="h-4 w-4 mr-2" />
                                        ) : (
                                            <Send className="h-4 w-4 mr-2" />
                                        )}
                                        {isProcessing ? "Processing Automated Report..." : confirmSendBatch ? "Confirm Dispatch?" : `Send Batch Now (${queue.length})`}
                                    </Button>
                                    {isProcessing && (
                                        <div className="flex items-center justify-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-md">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] text-blue-700 font-medium italic">Automated dispatch is active. Please wait...</span>
                                        </div>
                                    )}
                                    {queue.length === 0 && !isProcessing && (
                                        <p className="text-[10px] text-zinc-400 text-center italic">Queue is currently empty</p>
                                    )}
                                </CardContent>
                            </Card>

                        </div>

                        {/* Queue Table */}
                        <div className="lg:col-span-2">
                            <Card className="border-zinc-200 shadow-sm flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <ListTodo className="h-5 w-5 text-orange-500" />
                                            Sitemap Email Dispatch Queue
                                        </CardTitle>
                                        <CardDescription>Waitlist of sitemaps pending for the next report.</CardDescription>
                                    </div>
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-bold">
                                        {queue.length} Pending
                                    </Badge>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden">
                                    <div className="rounded-lg border border-zinc-100 overflow-x-auto">
                                        <table className="w-full text-sm min-w-[700px]">
                                            <thead className="bg-zinc-50 border-b border-zinc-100">
                                                <tr>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Sitemap URL</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Status</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Errors</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">Submitted At</th>
                                                    <th className="py-3 px-4 text-left font-bold text-zinc-500 uppercase tracking-tighter text-[10px]">User</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100">
                                                {loadingQueue ? (
                                                    <tr>
                                                        <td colSpan="5" className="py-12 text-center text-zinc-400 font-medium">
                                                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                                            Fetching queue...
                                                        </td>
                                                    </tr>
                                                ) : queue.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="py-12 text-center text-zinc-400 font-medium">
                                                            <History className="h-6 w-6 mx-auto mb-2 opacity-20" />
                                                            No submissions currently in queue.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    queue.map((item) => (
                                                        <tr key={item._id} className="hover:bg-zinc-50/50 transition-colors">
                                                            <td className="py-3 px-4 text-zinc-900 font-bold truncate max-w-[200px]">{item.sitemapUrl}</td>
                                                            <td className="py-3 px-4">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                                                    item.healthStatus === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                                                                        item.healthStatus === "ERROR" ? "bg-red-100 text-red-700" :
                                                                            "bg-amber-100 text-amber-700"
                                                                )}>
                                                                    {item.healthStatus || 'QUEUED'}
                                                                </span>
                                                            </td>
                                                            <td className={cn(
                                                                "py-3 px-4 text-xs font-bold",
                                                                item.errorCount > 0 ? "text-red-600" : "text-emerald-600"
                                                            )}>
                                                                {item.errorCount || 0}
                                                            </td>
                                                            <td className="py-3 px-4 text-zinc-500 text-xs">{new Date(item.submittedAt).toLocaleDateString()}</td>
                                                            <td className="py-3 px-4 text-zinc-500 text-xs font-medium italic">{item.userEmail || 'System'}</td>
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

                    {/* Dispatch History (Full Width) */}
                    <Card className="border-zinc-200 shadow-sm">
                        <CardHeader className="pb-3 border-b border-zinc-50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <History className="h-5 w-5 text-emerald-600" />
                                    Dispatch History
                                </CardTitle>
                                <Badge variant="outline" className="text-[10px] font-bold text-zinc-400 bg-zinc-50">
                                    Latest 20 activities
                                </Badge>
                            </div>
                            <CardDescription>
                                Track automated batch runs and manual consolidated report dispatches.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {logs.length === 0 ? (
                                <div className="py-12 text-center text-zinc-400 font-medium">
                                    <History className="h-6 w-6 mx-auto mb-2 opacity-20" />
                                    No logs recorded yet.
                                </div>
                            ) : (
                                <div className="max-h-[600px] overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {logs.slice(0, 20).map((log, idx) => (
                                            <div key={log._id || idx} className={cn(
                                                "p-4 rounded-xl border transition-all duration-200 hover:shadow-md hover:border-zinc-300",
                                                log.status === "SUCCESS" ? "bg-emerald-50/30 border-emerald-100/60" :
                                                    log.status === "ERROR" ? "bg-red-50/30 border-red-100/60" :
                                                        "bg-zinc-50/50 border-zinc-100"
                                            )}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                                        log.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" :
                                                            log.status === "ERROR" ? "bg-red-100 text-red-700" : "bg-zinc-200 text-zinc-700"
                                                    )}>
                                                        {log.status}
                                                    </span>
                                                    <span className="text-zinc-500 font-bold text-[10px] flex items-center gap-1">
                                                        <Clock3 className="h-3 w-3" />
                                                        {new Date(log.timestamp).toLocaleString('en-IN', {
                                                            dateStyle: 'medium',
                                                            timeStyle: 'short'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-zinc-800 text-xs font-semibold leading-relaxed break-words line-clamp-3 mb-3">
                                                    {log.message}
                                                </p>
                                                {log.itemCount > 0 && (
                                                    <div className="pt-3 border-t border-zinc-100/50 flex items-center justify-between">
                                                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Payload Size</span>
                                                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 font-black text-[9px] px-1.5 h-4">
                                                            {log.itemCount} ITEMS
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {logs.length > 0 && logs.length >= 20 && (
                                <div className="mt-6 flex items-center justify-center">
                                    <div className="h-px flex-1 bg-zinc-100" />
                                    <span className="px-4 text-[10px] text-zinc-400 font-bold uppercase tracking-widest italic">End of recent history</span>
                                    <div className="h-px flex-1 bg-zinc-100" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <FaviconCropModal
                isOpen={cropModalOpen}
                onOpenChange={setCropModalOpen}
                imageSrc={tempFaviconSrc}
                onCropComplete={(croppedImage) => {
                    setSettings(prev => ({ ...prev, faviconUrl: croppedImage }));
                }}
            />
        </div >
    );
}
