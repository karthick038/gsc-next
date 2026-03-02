"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Globe, CheckCircle2, XCircle, AlertCircle, AlertTriangle, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";
import { useConnection } from "@/hooks/use-connection";

// Helper Component for Log Items
function LogItem({ log }) {
    const { status, action, url, data, error, statusCode, timestamp } = log;

    let actionColor = "text-zinc-500";
    if (action === "Update") actionColor = "text-blue-600 dark:text-blue-400";
    else if (action === "Remove") actionColor = "text-amber-600 dark:text-amber-400";

    const isSuccess = status === "SUCCESS" || (statusCode >= 200 && statusCode < 300);
    const badgeColor = isSuccess
        ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
        : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";

    const codeDisplay = statusCode ? (
        <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${badgeColor}`}>
            {statusCode} {isSuccess ? "OK" : "Error"}
        </div>
    ) : <div></div>;

    const timeDisplay = (
        <div className="px-2 py-0.5 rounded text-xs border bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
            {timestamp}
        </div>
    );

    const Header = (
        <div className="flex justify-between items-center mb-2">
            {codeDisplay}
            {timeDisplay}
        </div>
    );

    if (status === "ERROR" && !data) {
        return (
            <div className="text-xs p-3 rounded border bg-red-50/50 border-red-200 dark:bg-red-900/20 dark:border-red-900 font-mono">
                {Header}
                <div className="font-bold mb-2 flex items-center gap-2 text-red-700 dark:text-red-400">
                    <XCircle className="h-3 w-3 flex-shrink-0" />
                    <span>Error : {url}</span>
                </div>
                <div className="bg-white dark:bg-zinc-950 p-2 rounded border overflow-x-auto text-muted-foreground">
                    <pre>{typeof error === 'object' ? JSON.stringify(error, null, 2) : error}</pre>
                </div>
            </div>
        );
    }

    return (
        <div className={`text-xs p-3 rounded border font-mono ${isSuccess ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 'bg-red-50/50 border-red-200 dark:bg-red-900/20 dark:border-red-900'}`}>
            {Header}
            <div className={`font-bold mb-2 flex items-center gap-2 ${actionColor}`}>
                <CheckCircle2 className={`h-3 w-3 flex-shrink-0 ${isSuccess ? 'text-green-600' : 'text-red-600'}`} />
                <span>{action} : {url}</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-2 rounded border overflow-x-auto text-muted-foreground">
                <pre>{JSON.stringify(data || error, null, 2)}</pre>
            </div>
        </div>
    );
}

export default function IndexingPage() {
    const [input, setInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");
    const [logs, setLogs] = useState([]);
    const [invalidUrls, setInvalidUrls] = useState([]);
    const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, pending: 0 });
    const [notificationType, setNotificationType] = useState("URL_UPDATED");

    // Quota State
    const [quota, setQuota] = useState({ usedCount: 0, limit: 200, remaining: 200 });
    const [isQuotaLoading, setIsQuotaLoading] = useState(true);

    const {
        indexingStatus,
        connectedSitesCount,
        verifiedSites,
        activeWebsite,
        setActiveWebsite,
        isLoading: isConnectionLoading,
        refreshStatus
    } = useConnection();

    const activeVerifiedSites = useMemo(() => {
        return (verifiedSites || []).filter(s => s.status === "SUCCESS");
    }, [verifiedSites]);

    const pillColors = [
        { border: "border-blue-400", selectBorder: "border-blue-600", text: "text-blue-600", hover: "hover:border-blue-600" },
        { border: "border-purple-400", selectBorder: "border-purple-600", text: "text-purple-600", hover: "hover:border-purple-600" },
        { border: "border-indigo-400", selectBorder: "border-indigo-600", text: "text-indigo-600", hover: "hover:border-indigo-600" },
        { border: "border-teal-400", selectBorder: "border-teal-600", text: "text-teal-600", hover: "hover:border-teal-600" },
        { border: "border-emerald-400", selectBorder: "border-emerald-600", text: "text-emerald-600", hover: "hover:border-emerald-600" },
    ];

    const isServiceAccountValid = connectedSitesCount > 0;
    const isValidating = isConnectionLoading;

    // Rule: Reset pill selection if connected websites change AND selected site is no longer valid
    useEffect(() => {
        if (activeWebsite && !activeVerifiedSites.find(s => s.url === activeWebsite)) {
            setActiveWebsite(null);
        }
    }, [activeVerifiedSites, activeWebsite, setActiveWebsite]);

    // Rule: Real-time validation against selected domain
    useEffect(() => {
        if (!activeWebsite || !input.trim()) {
            setInvalidUrls([]);
            return;
        }

        const urls = input.split(/[\r\n]+/).map(l => l.trim()).filter(l => l);
        const invalid = urls.filter(url => !validateUrlDomain(url).isValid);
        setInvalidUrls(invalid);
    }, [input, activeWebsite]);

    // Fetch Quota (Website-specific)
    const fetchQuota = async (url = activeWebsite) => {
        if (!url) return;
        setIsQuotaLoading(true);
        try {
            const res = await fetch(`/api/indexing-quota?website=${encodeURIComponent(url)}`);
            if (res.ok) {
                const data = await res.json();
                setQuota(data);
            }
        } catch (error) {
            console.error("Failed to fetch quota:", error);
        } finally {
            setIsQuotaLoading(false);
        }
    };

    // Check Status on Website Selection
    useEffect(() => {
        if (activeWebsite) {
            fetchQuota(activeWebsite);
        } else {
            setQuota({ used: 0, limit: 200, remaining: 200 });
            setIsQuotaLoading(false);
        }
    }, [activeWebsite]);


    // CSV State
    const [inputType, setInputType] = useState('text'); // 'text' | 'csv'
    const [csvFile, setCsvFile] = useState(null);
    const [parsedCsvUrls, setParsedCsvUrls] = useState([]);
    const fileInputRef = useRef(null);

    const BATCH_SIZE = 50;
    const COOLING_DELAY = 20000; // 20 seconds

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCsvFile(file);
            setInputType('csv');
            setInput("");

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l);
                setParsedCsvUrls(lines);
                if (invalidUrls.length > 0) setInvalidUrls([]);
            };
            reader.readAsText(file);
        }
    };

    const clearFile = () => {
        setCsvFile(null);
        setParsedCsvUrls([]);
        setInputType('text');
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleStart = async () => {
        const currentUrls = inputType === 'text'
            ? input.split(/[\r\n]+/).map(l => l.trim()).filter(l => l)
            : parsedCsvUrls;

        // Step 1: Pill Website Validation
        if (!activeWebsite) {
            setLogs([{
                status: "ERROR",
                error: "No website selected. Please select a property pill at the top first.",
                url: "Validation",
                action: "Error"
            }]);
            return;
        }

        // Step 2: URL Domain Match
        const invalidMatches = currentUrls.filter(url => !validateUrlDomain(url).isValid);
        if (invalidMatches.length > 0) {
            // Instant inline validation instead of internal error
            setLogs(invalidMatches.map(url => ({
                status: "ERROR",
                error: validateUrlDomain(url).error || "URL does not match selected property",
                url: url,
                action: "Blocked"
            })));
            return;
        }

        // Step 3: Google Connection State
        if (!isServiceAccountValid || indexingStatus === "DISCONNECTED" || indexingStatus === "NOT_VERIFIED") {
            setLogs([{
                status: "ERROR",
                error: "Google Search Console connection is missing or invalid. Please check your credentials.",
                url: "GSC Check",
                action: "Error"
            }]);
            return;
        }

        // Quota safety check (Pre-check)
        if (currentUrls.length > quota.remaining) {
            setLogs([{ status: "ERROR", error: `Quota exceeded. You have ${quota.remaining} URLs remaining, but provided ${currentUrls.length}.`, url: "N/A", action: "Error" }]);
            return;
        }

        if (isValidating) return;

        // Step 4: Call indexing request API

        setIsProcessing(true);
        setLogs([]);
        setProgress(0);
        setStatusMessage("Initializing...");

        const lines = currentUrls;
        const totalUrls = lines.length;
        setStats({ total: totalUrls, completed: 0, failed: 0, pending: totalUrls });

        const batches = [];
        for (let i = 0; i < totalUrls; i += BATCH_SIZE) {
            batches.push(lines.slice(i, i + BATCH_SIZE));
        }

        const totalBatches = batches.length;

        for (let i = 0; i < totalBatches; i++) {
            const batchNum = i + 1;
            const batchUrls = batches[i];

            setStatusMessage(`Processing batch ${batchNum} of ${totalBatches}...`);

            try {
                const res = await fetch("/api/indexing-request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        urls: batchUrls,
                        type: notificationType,
                        selectedWebsite: activeWebsite
                    }),
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    const errorMessage = errorData.details || errorData.error || `API Error ${res.status}`;
                    throw new Error(errorMessage);
                }

                const data = await res.json();
                const results = data.results || [];

                // Refresh quota after batch
                await fetchQuota();

                let batchSuccess = 0;
                let batchFail = 0;

                results.forEach(r => {
                    if (r.status === "SUCCESS") batchSuccess++;
                    else batchFail++;

                    let actionLabel = "Unknown";
                    const apiType = r.data?.urlNotificationMetadata?.latestUpdate?.type;

                    if (apiType === "URL_UPDATED") {
                        actionLabel = "Update";
                    } else if (apiType === "URL_DELETED") {
                        actionLabel = "Remove";
                    } else {
                        if (notificationType === "URL_UPDATED") actionLabel = "Update";
                        else if (notificationType === "URL_DELETED") actionLabel = "Remove";
                    }

                    const now = new Date();
                    const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

                    setLogs(prev => [
                        {
                            status: r.status,
                            action: actionLabel,
                            url: r.url,
                            data: r.data,
                            error: r.error,
                            statusCode: r.httpCode,
                            timestamp: timestamp
                        },
                        ...prev
                    ]);
                });

                setStats(prev => ({
                    ...prev,
                    completed: prev.completed + batchSuccess,
                    failed: prev.failed + batchFail,
                    pending: prev.pending - batchUrls.length
                }));

            } catch (error) {
                console.error("Batch failed", error);
                setLogs(prev => [{ status: "ERROR", error: `Batch ${batchNum} failed: ${error.message}`, url: "Batch " + batchNum, action: "Error" }]);
                setStats(prev => ({ ...prev, failed: prev.failed + batchUrls.length, pending: prev.pending - batchUrls.length }));
            }

            const percent = Math.round(((i + 1) / totalBatches) * 100);
            setProgress(percent);

            if (i < totalBatches - 1) {
                let timeLeft = COOLING_DELAY / 1000;
                while (timeLeft > 0) {
                    setStatusMessage(`Cooling down... resuming in ${timeLeft}s`);
                    await new Promise(r => setTimeout(r, 1000));
                    timeLeft--;
                }
            }
        }

        setStatusMessage("Completed.");
        setIsProcessing(false);
        await fetchQuota();
    };

    const isGlobalDisabled = !activeWebsite || connectedSitesCount === 0 || isValidating;
    // URL validation helper
    const validateUrlDomain = (url) => {
        if (!activeWebsite) return { isValid: false, error: "Please select a website above" };
        try {
            const enteredUrl = new URL(url);
            const siteUrl = new URL(activeWebsite);

            // Check domain (removing trailing slashes)
            const enteredDomain = enteredUrl.hostname.toLowerCase();
            const siteDomain = siteUrl.hostname.toLowerCase();

            if (enteredDomain !== siteDomain) {
                return { isValid: false, error: "Entered URL does not belong to the selected website" };
            }

            // Protocol validation removed - both http and https are acceptable
            // Google Search Console handles both variants

            return { isValid: true };
        } catch (e) {
            return { isValid: false, error: "Invalid URL format" };
        }
    };

    const currentUrlCount = inputType === 'text'
        ? input.split(/[\r\n]+/).filter(l => l.trim()).length
        : parsedCsvUrls.length;

    const MAX_URL_COUNT_LIMIT = 100;
    const isUrlLimitExceeded = currentUrlCount > MAX_URL_COUNT_LIMIT;

    const isInsufficientQuota = currentUrlCount > quota.remaining;
    const isLimitReached = quota.remaining <= 0;

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            {(!isServiceAccountValid || indexingStatus === "DISCONNECTED") && !isConnectionLoading && (
                <div className="flex flex-col items-center justify-center py-20 bg-zinc-50/50 rounded-2xl border-2 border-dashed border-zinc-200 animate-in fade-in slide-in-from-top-4">
                    <ShieldAlert className="h-12 w-12 text-zinc-300 mb-4" />
                    <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tight">No valid service account connection found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm text-center mt-2 mb-6">
                        Please upload and verify a valid JSON file in the Credentials tab to access indexing requests.
                    </p>
                    <Button variant="outline" size="sm" asChild className="font-bold border-2">
                        <a href="/dashboard/credentials" className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4" />
                            Upload Credentials
                        </a>
                    </Button>
                </div>
            )}

            {/* Website Selector Pills - rendered ONLY IF connected/partial */}
            {isServiceAccountValid && (indexingStatus === "CONNECTED" || indexingStatus === "PARTIAL") && activeVerifiedSites.length > 0 && !isConnectionLoading && (
                <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">

                    </label>
                    <div className="flex flex-wrap gap-3 mt-4">
                        {activeVerifiedSites.map((site, index) => {
                            const colors = pillColors[index % pillColors.length];
                            const isSelected = activeWebsite === site.url;
                            return (
                                <button
                                    key={site.url}
                                    onClick={() => setActiveWebsite(site.url)}
                                    className={`rounded-full text-xs font-bold transition-opacity duration-150 cursor-pointer bg-transparent focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none hover:opacity-80
                                        ${isSelected
                                            ? `border-2 ${colors.selectBorder} ${colors.text} px-[11px] py-[5px]`
                                            : `border ${colors.border} opacity-100 px-3 py-1.5`
                                        }`}
                                >
                                    {site.url}
                                    {isSelected && (
                                        <CheckCircle2 className={`h-4 w-4 inline-block ml-2 ${colors.text}`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {activeWebsite && (
                        <p className="text-[11px] text-zinc-400 font-medium ml-1">
                            Current scope: <span className={`font-extrabold uppercase tracking-tight ${pillColors[activeVerifiedSites.findIndex(s => s.url === activeWebsite) % pillColors.length]?.text || 'text-zinc-600'}`}>{activeWebsite}</span>
                        </p>
                    )}
                </div>
            )}

            <div className={`space-y-6 transition-all duration-300 ${(!isServiceAccountValid || indexingStatus === "DISCONNECTED" || !activeWebsite || isConnectionLoading) ? "opacity-40 pointer-events-none grayscale" : ""}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">Indexing Request</h1>
                        <p className="text-muted-foreground">Batch submit URLs to Google Indexing API.</p>
                    </div>

                    {/* Per-Website Quota Indicator - rendered ONLY IF connected/partial */}
                    {activeWebsite && (indexingStatus === 'CONNECTED' || indexingStatus === 'PARTIAL') && (
                        <Card className={`flex flex-col p-4 border min-w-[300px] transition-all duration-300 ${isLimitReached ? 'bg-red-50 border-red-200' : 'bg-zinc-50/50'}`}>
                            <div className="flex flex-col space-y-1.5 w-full">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className={`h-4 w-4 ${isLimitReached ? 'text-red-500' : 'text-zinc-500'}`} />
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Daily Quota for {new URL(activeWebsite).hostname}</span>
                                    </div>
                                    {isQuotaLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                                </div>
                                <div className="h-1 w-full bg-zinc-200 rounded-full overflow-hidden mt-1">
                                    <div
                                        className={`h-full transition-all duration-500 ${isLimitReached ? 'bg-red-500' : 'bg-blue-600'}`}
                                        style={{ width: `${(quota.remaining / quota.limit) * 100}%` }}
                                    />
                                </div>
                                <div className="flex items-baseline gap-1.5 transition-all">
                                    <span className={`text-2xl font-mono font-black tracking-tighter ${isLimitReached ? 'text-red-600' : 'text-zinc-900'}`}>
                                        {isQuotaLoading ? "..." : quota.remaining}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">/ {quota.limit} URLs remaining</span>
                                </div>
                                {isLimitReached && (
                                    <p className="text-[9px] font-black text-red-500 uppercase mt-1 animate-pulse">
                                        Daily quota exhausted for this website. Try again tomorrow.
                                    </p>
                                )}
                            </div>
                        </Card>
                    )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="h-5 w-5" />
                                Submit URLs
                            </CardTitle>
                            <CardDescription>
                                Enter URLs manually or upload a CSV file.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLimitReached && (
                                <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 mb-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Quota Reached</AlertTitle>
                                    <AlertDescription>
                                        You have reached your daily limit of 200 URLs. Please come back tomorrow.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {isInsufficientQuota && currentUrlCount > 0 && !isLimitReached && (
                                <Alert variant="warning" className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 mb-4 py-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                        Warning: You are trying to submit {currentUrlCount} URLs, but only {quota.remaining} remain in your daily quota.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <RadioGroup
                                defaultValue="URL_UPDATED"
                                value={notificationType}
                                onValueChange={setNotificationType}
                                className="flex flex-col space-y-4 mb-4"
                                disabled={isGlobalDisabled || isLimitReached}
                            >
                                <div className="flex items-start space-x-3 space-y-0 text-zinc-600 dark:text-zinc-400">
                                    <RadioGroupItem value="URL_UPDATED" id="r1" className="mt-1" />
                                    <div className="flex flex-col space-y-1">
                                        <Label htmlFor="r1" className="leading-none font-medium cursor-pointer">
                                            Publish / Update URL
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Notify Google to index new or updated content.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3 space-y-0 text-zinc-600 dark:text-zinc-400">
                                    <RadioGroupItem value="URL_DELETED" id="r2" className="mt-1" />
                                    <div className="flex flex-col space-y-1">
                                        <Label htmlFor="r2" className="leading-none font-medium cursor-pointer">
                                            Remove URL
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Request Google to remove a URL from search results.
                                        </p>
                                    </div>
                                </div>
                            </RadioGroup>

                            <div className={inputType === 'csv' || isLimitReached ? "opacity-50 pointer-events-none" : ""}>
                                <Label className="mb-2 block">Manual Entry</Label>
                                <Textarea
                                    placeholder={`https://example.com/page-1\nhttps://example.com/page-2`}
                                    className={`min-h-[100px] max-h-[300px] font-mono text-sm resize-none ${invalidUrls.length > 0 && inputType === 'text' ? "border-red-500 bg-red-50 dark:bg-red-900/10" : ""} ${isInsufficientQuota && inputType === 'text' ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10" : ""}`}
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        if (e.target.value.trim()) setInputType('text');
                                        if (invalidUrls.length > 0) setInvalidUrls([]);
                                    }}
                                    disabled={isProcessing || inputType === 'csv' || isGlobalDisabled || isLimitReached}
                                />
                                {isUrlLimitExceeded && inputType === 'text' && (
                                    <div className="text-xs font-bold text-red-600 dark:text-red-400 mt-2 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        <span>You can submit a maximum of 100 URLs at a time.</span>
                                    </div>
                                )}
                            </div>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
                                <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground uppercase">OR</span>
                                <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
                            </div>

                            <div className={(inputType === 'text' && input.trim()) || isLimitReached ? "opacity-50 pointer-events-none" : ""}>
                                <Label className="mb-2 block text-sm font-medium text-gray-700">
                                    Upload CSV (Max 100 URLs)
                                    <span className="block text-xs text-gray-500">
                                        Each row should contain only one URL.
                                    </span>
                                </Label>

                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        accept=".csv"
                                        disabled={isProcessing || (inputType === 'text' && input.trim().length > 0) || isGlobalDisabled || isLimitReached}
                                        className="cursor-pointer"
                                        onChange={handleFileChange}
                                        ref={fileInputRef}
                                    />
                                    {inputType === 'csv' && (
                                        <Button variant="ghost" size="sm" onClick={clearFile} disabled={isProcessing || isGlobalDisabled}>
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                {csvFile && (
                                    <div className="flex flex-col space-y-2 mt-1">
                                        <p className={`text-xs ${isInsufficientQuota ? "text-amber-600 font-medium" : (isUrlLimitExceeded && inputType === 'csv' ? "text-red-600 font-bold" : "text-muted-foreground")}`}>
                                            Selected: {csvFile.name} ({parsedCsvUrls.length} URLs found)
                                        </p>
                                        {isUrlLimitExceeded && inputType === 'csv' && (
                                            <div className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                                                <AlertCircle className="h-3.5 w-3.5" />
                                                <span>CSV contains {parsedCsvUrls.length} URLs. Maximum allowed is 100.</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {invalidUrls.length > 0 && (
                                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                    <div className="font-semibold mb-1">Invalid URLs Detected</div>
                                    <ul className="list-disc pl-4 space-y-0.5 font-mono break-all max-h-[100px] overflow-y-auto">
                                        {invalidUrls.slice(0, 5).map((u, i) => <li key={i}>{u}</li>)}
                                        {invalidUrls.length > 5 && <li>...and {invalidUrls.length - 5} more</li>}
                                    </ul>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <span className={isInsufficientQuota ? "text-amber-600 font-bold" : ""}>
                                    {currentUrlCount} / {quota.remaining} URLs Available
                                </span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="w-full">
                                            <Button
                                                variant="destructive"
                                                onClick={handleStart}
                                                disabled={isProcessing || (inputType === 'text' && !input.trim()) || (inputType === 'csv' && !csvFile) || isGlobalDisabled || isLimitReached || isInsufficientQuota || invalidUrls.length > 0 || isUrlLimitExceeded}
                                                className={`w-full font-bold uppercase tracking-widest h-10 text-xs shadow-md transition-all ${invalidUrls.length > 0 || isLimitReached || isUrlLimitExceeded ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer hover:shadow-lg active:scale-95'}`}
                                            >
                                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {isProcessing ? "Processing..." : (isGlobalDisabled ? (isValidating ? "Validating Credentials..." : "Select a Website") : (isLimitReached ? "Quota Exhausted" : (isUrlLimitExceeded ? "Limit Exceeded" : (isInsufficientQuota ? "Insufficient Quota" : (invalidUrls.length > 0 ? "Invalid URLs" : "Start Indexing")))))}
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    {((!isServiceAccountValid || indexingStatus === "DISCONNECTED") || invalidUrls.length > 0 || isLimitReached || isUrlLimitExceeded) && (
                                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-800 p-3 shadow-2xl max-w-[300px]">
                                            <div className="space-y-1">
                                                <p className="text-xs font-black uppercase text-red-500 mb-1">
                                                    {(!isServiceAccountValid || indexingStatus === "DISCONNECTED") ? "Connection Error" : (isLimitReached ? "Quota Exhausted" : (isUrlLimitExceeded ? "Limit Exceeded" : "Validation Error"))}
                                                </p>
                                                <p className="text-xs font-medium leading-relaxed">
                                                    {(!isServiceAccountValid || indexingStatus === "DISCONNECTED")
                                                        ? "Upload and verify a valid JSON file to enable indexing"
                                                        : (isLimitReached
                                                            ? "Daily indexing quota exhausted for this website. Try again tomorrow."
                                                            : (isUrlLimitExceeded
                                                                ? (inputType === 'csv' ? `CSV contains ${parsedCsvUrls.length} URLs. Please reduce to 100.` : "You can only submit up to 100 URLs at a time manually.")
                                                                : `Please enter a valid URL that matches the selected website: ${activeWebsite}`))}
                                                </p>
                                            </div>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        </CardFooter>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Progress</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>{statusMessage || "Ready to start"}</span>
                                        <span>{stats.completed + stats.failed} / {stats.total}</span>
                                    </div>
                                    <Progress value={(stats.completed + stats.failed) / (stats.total || 1) * 100} />
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-800">
                                        <div className="text-xl font-bold">{stats.completed}</div>
                                        <div className="text-xs text-muted-foreground text-green-600 font-medium tracking-tight">Success</div>
                                    </div>
                                    <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-800">
                                        <div className="text-xl font-bold">{stats.failed}</div>
                                        <div className="text-xs text-muted-foreground text-red-600 font-medium tracking-tight">Failed</div>
                                    </div>
                                    <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-800">
                                        <div className="text-xl font-bold">{stats.pending}</div>
                                        <div className="text-xs text-muted-foreground tracking-tight">Pending</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="flex flex-col h-[400px]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Live Activity Log</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto space-y-2">
                                {logs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                                        <AlertCircle className="h-8 w-8 mb-2" />
                                        <p className="text-sm">Logs will appear here</p>
                                    </div>
                                )}
                                {logs.map((log, i) => (
                                    <LogItem key={i} log={log} />
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
