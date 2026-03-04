"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    UploadCloud, CheckCircle, CheckCircle2, AlertCircle, AlertTriangle, Loader2, FileText,
    Trash2, KeyRound, Activity, Globe, Plus, Minus, XCircle, Info, RefreshCcw, ShieldAlert, X, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/hooks/use-connection";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// URL Normalization Helper
const normalizeUrl = (url) => {
    if (!url) return "";
    return url
        .trim()
        .toLowerCase()
        .replace(/\/$/, "") // Remove trailing slash
        .replace(/^https?:\/\//, ""); // Remove protocol for comparison
};

export default function UploadJSON() {
    const { refreshStatus, disconnect, indexingStatus, verifiedSites, userEmail, isLoading: hookLoading } = useConnection();
    const [status, setStatus] = useState("loading"); // loading, idle
    const [message, setMessage] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [existingAccounts, setExistingAccounts] = useState([]);
    const [siteUrls, setSiteUrls] = useState([""]);
    const [isSavingAndChecking, setIsSavingAndChecking] = useState(false);

    // Test Connection States
    const [connectionStatus, setConnectionStatus] = useState({
        state: "idle", // idle, testing, success, partial, error, not_verified
        result: null,
        lastTested: null
    });
    const [isVerified, setIsVerified] = useState(false); // Can save only if verified
    const [isAlertVisible, setIsAlertVisible] = useState(false);
    const resultsTimerRef = useRef(null);

    // Delete Modal State
    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null, filename: "", type: "account", url: "" });

    const fileInputRef = useRef(null);
    const [showForm, setShowForm] = useState(false);
    const [newSiteUrl, setNewSiteUrl] = useState("");
    const [serviceAccountEmail, setServiceAccountEmail] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);

    // Default Email from Session
    useEffect(() => {
        if (showForm && !serviceAccountEmail && userEmail) {
            setServiceAccountEmail(userEmail);
        }
    }, [showForm, userEmail, serviceAccountEmail]);

    // Real-time Validation logic
    const urlValidation = useMemo(() => {
        return siteUrls.map((url, index) => {
            const trimmedUrl = url.trim();
            if (!trimmedUrl) return { isValid: false, error: "" };

            // 1. Protocol & Basic Format Check
            const hasProtocol = trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://");
            if (!hasProtocol) {
                return { isValid: false, error: "Please enter a valid URL starting with http:// or https://" };
            }

            // 2. Structural Validation
            try {
                new URL(trimmedUrl);
            } catch (e) {
                return { isValid: false, error: "Please enter a valid URL starting with http:// or https://" };
            }

            // 3. Duplicate check with normalization
            const currentNormalized = normalizeUrl(trimmedUrl);
            const isDuplicate = siteUrls.some((u, i) => i !== index && normalizeUrl(u) === currentNormalized);

            if (isDuplicate) {
                return { isValid: false, error: "This website is already added." };
            }

            return { isValid: true, error: "" };
        });
    }, [siteUrls]);

    const isAllUrlsValid = useMemo(() => {
        const nonSharedUrls = siteUrls.filter(u => u.trim());
        if (nonSharedUrls.length === 0) return false;
        return urlValidation.every((v, i) => !siteUrls[i].trim() || v.isValid);
    }, [siteUrls, urlValidation]);

    const canSaveAndCheck = isAllUrlsValid && existingAccounts.length > 0 && !isSavingAndChecking;

    // Initial load
    useEffect(() => {
        const initialize = async () => {
            await Promise.all([fetchAccounts(), fetchSites()]);
            setStatus("idle");
        };
        initialize();

        return () => {
            if (resultsTimerRef.current) clearTimeout(resultsTimerRef.current);
        };
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/upload");
            if (res.ok) {
                const data = await res.json();
                setExistingAccounts(data.accounts || []);
            }
        } catch (e) {
            console.error("Failed to fetch accounts", e);
        }
    };

    const fetchSites = async () => {
        try {
            const res = await fetch("/api/sites");
            if (res.ok) {
                const data = await res.json();
                setSiteUrls(data.siteUrls.length > 0 ? data.siteUrls : [""]);

                let state = "idle";
                if (data.indexingStatus === "CONNECTED") state = "success";
                else if (data.indexingStatus === "PARTIAL") state = "partial";

                setConnectionStatus(prev => ({
                    ...prev,
                    state: data.indexingStatus === "NOT_VERIFIED" ? "not_verified" : state,
                    lastTested: data.lastConnectionTestAt
                }));
                setIsVerified(data.indexingStatus === "CONNECTED" || data.indexingStatus === "PARTIAL");
            }
        } catch (e) {
            console.error("Failed to fetch sites", e);
        }
    };

    const resetVerification = () => {
        setIsVerified(false);
        setConnectionStatus(prev => ({ ...prev, state: "not_verified", result: null }));
    };


    const updateSiteUrl = (index, value) => {
        const newUrls = [...siteUrls];
        newUrls[index] = value;
        setSiteUrls(newUrls);
        resetVerification();
    };

    const addSiteField = () => {
        setSiteUrls([...siteUrls, ""]);
        resetVerification();
    };

    const removeSiteField = (index) => {
        if (siteUrls.length > 1) {
            const newUrls = [...siteUrls];
            newUrls.splice(index, 1);
            setSiteUrls(newUrls);
            resetVerification();
        }
    };

    // Unified Save & Check handler logic moved into handleSaveAndCheck

    // JSON Validation
    const validateServiceAccount = (json) => {
        try {
            const data = JSON.parse(json);
            return !!(data.client_email && data.private_key && data.project_id);
        } catch (e) {
            return false;
        }
    };

    // File Upload Handlers
    const handleFileSelect = async (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        setIsUploading(true);
        setMessage("");

        const formData = new FormData();
        let invalidFilename = "";

        for (const file of selectedFiles) {
            const text = await file.text();
            if (!validateServiceAccount(text)) {
                invalidFilename = file.name;
                break;
            }
            formData.append("file", file);
        }

        if (invalidFilename) {
            setMessage(`Invalid service account JSON file: ${invalidFilename}. Please upload a valid Google service account key.`);
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (res.ok) {
                await fetchAccounts();
                resetVerification();
                refreshStatus(); // Refresh global connection state
                const failures = data.results?.filter(r => r.error);
                if (failures?.length > 0) {
                    setMessage(`Some files failed: ${failures.map(f => `${f.filename} (${f.error})`).join(", ")}`);
                }
            } else {
                setMessage(data.error || "Upload failed");
            }
        } catch (error) {
            console.error("Upload error:", error);
            setMessage("Network error during upload");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleRemoveSite = async (url) => {
        try {
            const res = await fetch("/api/sites", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            if (res.ok) {
                setMessage(""); // Clear any stale error messages
                await refreshStatus();
            } else {
                const data = await res.json();
                throw new Error(data.error || "Failed to remove site");
            }
        } catch (error) {
            console.error("Removal Error:", error);
            alert(error.message);
        } finally {
            setDeleteModal({ open: false, id: null, filename: "", type: "account", url: "" });
        }
    };

    const handleConfirmDelete = async () => {
        if (deleteModal.type === "site") {
            await handleRemoveSite(deleteModal.url);
            return;
        }

        const { id } = deleteModal;
        if (!id) return;

        try {
            const res = await fetch(`/api/upload?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                setExistingAccounts(prev => prev.filter(acc => acc.id !== id));
                setDeleteModal({ open: false, id: null, filename: "", type: "account", url: "" });
                resetVerification();
                refreshStatus(); // Refresh global connection state
            }
        } catch (e) {
            console.error("Delete error", e);
        }
    };

    const handleSaveAndCheck = async () => {
        const currentUrls = siteUrls.filter(u => u.trim());
        if (currentUrls.length === 0) return;

        if (resultsTimerRef.current) clearTimeout(resultsTimerRef.current);
        setConnectionStatus(prev => ({ ...prev, state: "testing", result: null }));
        setIsSavingAndChecking(true);
        setIsAlertVisible(false);

        try {
            const res = await fetch("/api/test-connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ siteUrls: currentUrls })
            });
            const data = await res.json();
            let newState = "error";
            if (res.ok) {
                if (data.status === "PASS") newState = "success";
                else if (data.status === "PARTIAL") newState = "partial";
            }

            setConnectionStatus({
                state: newState,
                result: data,
                lastTested: new Date().toISOString()
            });

            // Is Verified if at least one SUCCESS
            const verified = data.status === "PASS" || data.status === "PARTIAL";
            setIsVerified(verified);

            setIsAlertVisible(true);
            refreshStatus(); // Refresh global connection state

        } catch (e) {
            setConnectionStatus({
                state: "error",
                result: { error: "Network error during check." },
                lastTested: new Date().toISOString()
            });
            setIsAlertVisible(true);

        } finally {
            setIsSavingAndChecking(false);
        }
    };

    const handleNewSaveAndConnect = async () => {
        const trimmedUrl = newSiteUrl.trim();
        if (!trimmedUrl || !selectedFile) return;

        // 0. Duplicate Website Check
        const normalizedInput = normalizeUrl(trimmedUrl);
        const isDuplicate = (verifiedSites || []).some(s => normalizeUrl(s.url) === normalizedInput);

        if (isDuplicate) {
            setMessage("This website is already connected. Please remove it before adding again.");
            return;
        }

        // 0.5. Email Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (serviceAccountEmail && !emailRegex.test(serviceAccountEmail)) {
            setMessage("Please enter a valid email address for notifications.");
            return;
        }

        setIsSavingAndChecking(true);
        setMessage("");

        try {
            // 1. Upload JSON
            const formData = new FormData();
            formData.append("file", selectedFile);
            if (serviceAccountEmail) {
                formData.append("customEmail", serviceAccountEmail);
            }

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) {
                throw new Error(uploadData.error || "Failed to upload JSON");
            }

            // Get the ID of the newly uploaded account
            const uploadedAccountId = uploadData.results?.[0]?.id;
            if (!uploadedAccountId) {
                throw new Error("Invalid service account file.");
            }

            // 2. Test Connection (Isolated to the new account)
            const testRes = await fetch("/api/test-connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    siteUrls: [trimmedUrl],
                    accountIds: [uploadedAccountId]
                })
            });

            const testData = await testRes.json();

            // Find the result for this specifically tested URL
            const urlResult = testData.urlResults?.find(r => normalizeUrl(r.url) === normalizedInput);

            if (testRes.ok && urlResult?.status === "SUCCESS") {
                // Success
                setShowForm(false);
                setNewSiteUrl("");
                setSelectedFile(null);
                await refreshStatus();
            } else {
                // FAILURE: Cleanup the uploaded service account immediately
                if (uploadedAccountId) {
                    await fetch(`/api/upload?id=${uploadedAccountId}`, { method: "DELETE" }).catch(e => console.error("Cleanup failed:", e));
                }

                // Even if the API returns 200, if the specific URL failed, show error
                const errorMsg = urlResult?.error || testData.error || "Service account does not have access to this website.";
                throw new Error(errorMsg);
            }

        } catch (error) {
            console.error("Save & Connect Error:", error);
            setMessage(error.message);
        } finally {
            setIsSavingAndChecking(false);
        }
    };


    return (
        <div className="space-y-8 max-w-6xl w-full mx-auto relative px-4 md:px-0">
            {/* Header with Title and Add Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Service Account Credentials</h2>
                    <p className="text-zinc-500 text-sm mt-1">Configure your site properties and authentication keys accurately.</p>
                </div>

                <div>
                    <Button
                        onClick={() => setShowForm(true)}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-100 transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Service Account Credentials
                    </Button>
                </div>
            </div>

            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="sm:max-w-2xl border-zinc-200 shadow-2xl overflow-hidden p-0">
                    <DialogHeader className="p-6 bg-zinc-50 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Plus className="h-5 w-5 text-blue-600" />
                            Add New Connection
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            Enter your website URL and upload your service account JSON file below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-zinc-400" />
                                Website URL
                            </label>
                            <Input
                                value={newSiteUrl}
                                onChange={(e) => setNewSiteUrl(e.target.value)}
                                placeholder="https://example.com"
                                className="h-11 border-zinc-200 focus:ring-blue-500"
                            />
                            <p className="text-[11px] text-zinc-400 italic">Example: https://example.com</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                                <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
                                User Email
                            </label>
                            <Input
                                value={serviceAccountEmail}
                                onChange={(e) => setServiceAccountEmail(e.target.value)}
                                placeholder="user@example.com"
                                className="h-11 border-zinc-200 focus:ring-blue-500 bg-zinc-50/50"
                            />
                            <p className="text-[11px] text-zinc-400 italic">By default, your account email is used. You can change it if needed.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-zinc-400" />
                                Upload Service Account JSON
                            </label>
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${selectedFile ? 'border-blue-300 bg-blue-50/50' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    accept=".json"
                                    ref={fileInputRef}
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setSelectedFile(file);
                                            // Auto-population of email from JSON is now removed to favor User Email
                                            // But we keep the file reading for verification if needed
                                        }
                                    }}
                                    className="hidden"
                                />
                                {selectedFile ? (
                                    <div className="flex flex-col items-center">
                                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                                            <FileText className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <p className="text-sm font-bold text-blue-900">{selectedFile.name}</p>
                                        <Button variant="ghost" size="sm" className="mt-3 text-zinc-500 hover:text-red-500 h-8" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>Change File</Button>
                                    </div>
                                ) : (
                                    <>
                                        <UploadCloud className="h-10 w-10 text-zinc-300 mb-3" />
                                        <p className="text-sm text-zinc-600 font-semibold tracking-tight">Click to upload the file</p>
                                        <p className="text-[11px] text-zinc-400 mt-1 uppercase font-bold tracking-widest">.json files only</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {message && (
                            <div className="p-3.5 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2.5 text-red-700 shadow-sm animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <p className="text-xs font-semibold leading-relaxed">{message}</p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-zinc-50 border-t flex gap-3 justify-end">
                        <Button
                            variant="ghost"
                            onClick={() => { setShowForm(false); setNewSiteUrl(""); setServiceAccountEmail(""); setSelectedFile(null); setMessage(""); }}
                            disabled={isSavingAndChecking}
                            className="font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleNewSaveAndConnect}
                            disabled={!newSiteUrl.trim() || !selectedFile || isSavingAndChecking}
                            className="bg-blue-600 hover:bg-blue-700 min-w-[140px] font-bold shadow-lg shadow-blue-100"
                        >
                            {isSavingAndChecking ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Connecting...
                                </>
                            ) : (
                                "Save & Connect"
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(status === "loading" || hookLoading) ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                        <p className="text-zinc-400 text-xs mt-4 font-medium tracking-wide uppercase">Loading Connections...</p>
                    </div>
                ) : verifiedSites.length > 0 ? (
                    verifiedSites.map((site, index) => {
                        // Helper to format permission level
                        const formatPermission = (perm) => {
                            if (!perm || perm === "none") return "None";
                            return perm
                                .replace("site", "")
                                .replace(/([A-Z])/g, " $1")
                                .trim() || perm;
                        };

                        return (
                            <Card key={index} className="border-zinc-200 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-visible bg-white">
                                {/* Removal Icon - Half-in, Half-out */}
                                <div className="absolute -top-3 -right-3 z-20">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => setDeleteModal({ open: true, type: "site", url: site.url, filename: "" })}
                                                    className="h-7 w-7 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-200 shadow-sm transition-all cursor-pointer hover:scale-110 active:scale-95"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Remove Connection</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>

                                <CardContent className="px-4 pb-0 space-y-4">
                                    {/* Row 1: Connection Status */}
                                    <div className="flex items-center">
                                        <Badge
                                            variant={site.status === "SUCCESS" ? "outline" : "destructive"}
                                            className={`h-6 px-2 text-[10px] uppercase tracking-wider font-bold ${site.status === "SUCCESS" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}
                                        >
                                            {site.status === "SUCCESS" ? (
                                                <span className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Connected
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5">
                                                    <XCircle className="h-3 w-3" />
                                                    Failed
                                                </span>
                                            )}
                                        </Badge>
                                    </div>

                                    {/* Row 2: Website URL */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <Globe className="h-4 w-4 text-blue-500" />
                                        </div>
                                        <p className="text-sm font-bold text-zinc-900 truncate" title={site.url}>
                                            {site.url}
                                        </p>
                                    </div>

                                    {/* Row 3: Permission Level & Service Account Email */}
                                    <div className="flex flex-col space-y-3 pt-1">
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest pl-0.5">Permission Level</p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-zinc-600 bg-zinc-50 border border-zinc-100 px-2.5 py-1 rounded-md">
                                                    <KeyRound className="h-3.5 w-3.5 text-zinc-400" />
                                                    <span className="text-xs font-semibold">
                                                        {formatPermission(site.permissionLevel)}
                                                    </span>
                                                </div>

                                                {site.status === "ERROR" && (
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 h-7"
                                                        onClick={() => { setShowForm(true); setNewSiteUrl(site.url); }}
                                                    >
                                                        Retry Connection
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {site.accountEmail && (
                                            <div className="space-y-1.5 border-t border-zinc-50 pt-3 pb-2">
                                                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest pl-0.5">Service Account</p>
                                                <div className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 transition-colors">
                                                    <Mail className="h-3 w-3 text-zinc-400" />
                                                    <span className="text-[11px] font-medium truncate" title={site.accountEmail}>
                                                        {site.accountEmail}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl border-zinc-100 bg-zinc-50/50">
                        <KeyRound className="h-12 w-12 text-zinc-200 mb-4" />
                        <h3 className="text-lg font-semibold text-zinc-900">No Credentials Added</h3>
                        <p className="text-zinc-500 text-sm mt-1 max-w-xs text-center">
                            Connect your first Google Search Console property by adding a service account JSON.
                        </p>
                        <Button
                            onClick={() => setShowForm(true)}
                            variant="outline"
                            className="mt-6 border-zinc-200"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Your First Site
                        </Button>
                    </div>
                )}
            </div>

            {/* Remove Confirmation Modal */}
            <AlertDialog open={deleteModal.open} onOpenChange={(open) => setDeleteModal(prev => ({ ...prev, open }))}>
                <AlertDialogContent className="shadow-2xl border-zinc-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">
                            {deleteModal.type === "site" ? "Remove Website?" : "Remove Credential?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-600">
                            {deleteModal.type === "site"
                                ? <>Are you absolutely sure you want to remove <strong>{deleteModal.url}</strong>? This will stop indexing services for this site.</>
                                : <>Are you absolutely sure you want to remove <strong>{deleteModal.filename}</strong>? This will permanently stop using this service account.</>
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2">
                        <AlertDialogCancel className="cursor-pointer font-medium hover:bg-zinc-100">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 cursor-pointer text-white border-0 font-bold px-4 h-9 text-xs shadow-lg shadow-red-100">
                            {deleteModal.type === "site" ? "Confirm Removal" : "Delete Account"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
