"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Loader2, CheckCircle2, XCircle, AlertCircle, AlertTriangle,
    RefreshCw, Map, ChevronDown, ChevronUp, ShieldAlert,
    KeyRound, Clock, Eye, Download, FileText, Info, Send, ArrowRightLeft, Search, ExternalLink, X
} from "lucide-react";
import { useConnection } from "@/hooks/use-connection";
import { cn } from "@/lib/utils";

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ statusLabel, errors, warnings }) {
    if (statusLabel === "Pending") {
        return (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 gap-1">
                <Clock className="h-3 w-3" /> Pending
            </Badge>
        );
    }
    if (statusLabel === "Has Errors") {
        return (
            <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 gap-1">
                <XCircle className="h-3 w-3" /> {errors} Error{errors !== 1 ? "s" : ""}
            </Badge>
        );
    }
    if (statusLabel === "Has Warnings") {
        return (
            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800 gap-1">
                <AlertTriangle className="h-3 w-3" /> {warnings} Warning{warnings !== 1 ? "s" : ""}
            </Badge>
        );
    }
    return (
        <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Success
        </Badge>
    );
}

// ─── Format date ──────────────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch {
        return dateStr;
    }
}

// ─── Error Detail Panel ───────────────────────────────────────────────────────
function ErrorDetailPanel({ siteUrl, feedpath, localHealthStatus }) {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // URL health check state
    const [urlCheck, setUrlCheck] = useState(null);       // { urls, summary }
    const [isCheckingUrls, setIsCheckingUrls] = useState(false);
    const [isInspectingUrls, setIsInspectingUrls] = useState(false);
    const [urlCheckError, setUrlCheckError] = useState(null);
    const [urlFilter, setUrlFilter] = useState("all");    // all | ok | redirect | error | indexed | non-indexed

    const abortControllerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(
                    `/api/sitemap/details?siteUrl=${encodeURIComponent(siteUrl)}&feedpath=${encodeURIComponent(feedpath)}`
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load details");
                setDetails(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [siteUrl, feedpath]);

    const handleCheckUrls = async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsCheckingUrls(true);
        setUrlCheckError(null);
        setUrlCheck(null);
        setUrlFilter("all");
        try {
            const res = await fetch("/api/sitemap/check-urls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ feedpath }),
                signal: controller.signal,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "URL check failed");

            // Mark indexing as intentionally skipped/hidden if user chose health check first
            setUrlCheck({
                ...data,
                checkMode: "health",
                indexingHidden: false // Restore visibility after completion
            });
            setUrlFilter("all");
        } catch (err) {
            if (err.name === "AbortError") return;
            setUrlCheckError(err.message);
        } finally {
            if (abortControllerRef.current === controller) {
                setIsCheckingUrls(false);
            }
        }
    };

    const handleInspectUrls = async () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsInspectingUrls(true);
        setUrlCheckError(null);
        setUrlFilter("all");

        try {
            let urlsToInspect = [];
            let isInitial = !urlCheck;

            // 1. Initial URL retrieval if needed
            if (isInitial) {
                const res = await fetch("/api/sitemap/inspect-urls", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        feedpath,
                        fetchOnly: true
                    }),
                    signal: controller.signal,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to fetch sitemap URLs");
                urlsToInspect = data.urls;

                // Initialize state with EMPTY results list but correct checkMode
                setUrlCheck({
                    checkMode: "indexing",
                    urls: [], // We'll add them one by one
                    summary: {
                        total: data.urls.length,
                        checked: 0,
                        ok: 0, redirects: 0, notFound: 0, errors: 0,
                        indexed: 0,
                        nonIndexed: 0
                    }
                });
            } else {
                urlsToInspect = urlCheck.urls.map(u => u.url);
                // Keep existing URLs but mark them all as unchecked/waiting if re-running
                // (Or as per user request: "Only one at a time should be processed and displayed")
                // Let's reset for clarity if re-running indexing
                setUrlCheck(prev => ({
                    ...prev,
                    checkMode: "indexing",
                    urls: [],
                    summary: { ...prev.summary, checked: 0, indexed: 0, nonIndexed: 0 }
                }));
            }

            // 2. Sequential processing loop
            for (let i = 0; i < urlsToInspect.length; i++) {
                const url = urlsToInspect[i];

                // Add "Processing..." row
                setUrlCheck(prev => ({
                    ...prev,
                    urls: [...prev.urls, {
                        url,
                        status: null,
                        statusText: "Processing...",
                        category: "unchecked",
                        inspection: { verdict: "UNKNOWN", indexStatus: "PROCESSING" }
                    }]
                }));

                // Call API for single URL inspection
                const res = await fetch("/api/sitemap/inspect-urls", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        urls: [url],
                        siteUrl
                    }),
                    signal: controller.signal,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `GSC inspection failed for ${url}`);

                const result = data.results[0];

                // Update row with final result and increment counts
                setUrlCheck(prev => {
                    const newUrls = [...prev.urls];
                    // Find the last item (the one we just added) to update it
                    newUrls[newUrls.length - 1] = {
                        url: result.url,
                        status: null,
                        statusText: result.inspection.indexStatus === "INDEXED" ? "Indexed" : "Not Indexed",
                        category: result.inspection.indexStatus === "INDEXED" ? "ok" : "error",
                        inspection: result.inspection
                    };

                    return {
                        ...prev,
                        urls: newUrls,
                        summary: {
                            ...prev.summary,
                            checked: prev.summary.checked + 1,
                            indexed: prev.summary.indexed + (result.inspection.indexStatus === "INDEXED" ? 1 : 0),
                            nonIndexed: prev.summary.nonIndexed + (result.inspection.indexStatus === "NOT_INDEXED" ? 1 : 0)
                        }
                    };
                });

                // Optional: Short delay to make "Processing..." visible if API is too fast
                // await new Promise(r => setTimeout(r, 300));
            }

        } catch (err) {
            if (err.name === "AbortError") {
                // Aborted by user — reset inspecting state cleanly
                setIsInspectingUrls(false);
                // Clear any partially-loaded indexing results
                setUrlCheck(null);
                return;
            }
            setUrlCheckError(err.message);
        } finally {
            if (abortControllerRef.current === controller) {
                setIsInspectingUrls(false);
            }
        }
    };

    const handleStopInspection = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsInspectingUrls(false);
        setUrlCheck(null);
        setUrlCheckError(null);
        setUrlFilter("all");
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-4 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading sitemap details...
            </div>
        );
    }
    if (error) {
        return (
            <div className="p-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
        );
    }
    if (!details) return null;

    return (
        <div className="px-4 pb-4 space-y-4">

            {/* ── Summary banner ── */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                <div className="flex items-center gap-3 flex-wrap">
                    {details.errors > 0 && (
                        <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-full px-3 py-1 text-xs font-bold">
                            <XCircle className="h-3.5 w-3.5" />
                            {details.errors} Error{details.errors !== 1 ? "s" : ""} detected
                        </div>
                    )}
                    {details.warnings > 0 && (
                        <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-full px-3 py-1 text-xs font-bold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {details.warnings} Warning{details.warnings !== 1 ? "s" : ""} detected
                        </div>
                    )}
                    {details.errors === 0 && details.warnings === 0 && !details.isPending && localHealthStatus !== "ERROR" && (
                        <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-full px-3 py-1 text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            No issues detected
                        </div>
                    )}
                </div>
            </div>

            {/* ── Metadata grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 space-y-0.5">
                    <p className="text-zinc-400 uppercase tracking-wider font-bold text-[10px]">Last Submitted</p>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{formatDate(details.lastSubmitted)}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 space-y-0.5">
                    <p className="text-zinc-400 uppercase tracking-wider font-bold text-[10px]">Last Read</p>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{formatDate(details.lastDownloaded)}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 space-y-0.5">
                    <p className="text-zinc-400 uppercase tracking-wider font-bold text-[10px]">Pending</p>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{details.isPending ? "Yes" : "No"}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 space-y-0.5">
                    <p className="text-zinc-400 uppercase tracking-wider font-bold text-[10px]">Sitemap Index</p>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{details.isSitemapsIndex ? "Yes" : "No"}</p>
                </div>
            </div>

            {/* ── Content breakdown ── */}
            {details.contents && details.contents.filter(c => c.type !== 'image').length > 0 && (
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Content Breakdown</p>
                    <div className="flex gap-3 flex-wrap">
                        {details.contents
                            .filter(c => c.type !== 'image')
                            .map((c, i) => (
                                <div key={i} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs">
                                    <FileText className="h-3 w-3 text-blue-500" />
                                    <span className="font-bold text-blue-700 dark:text-blue-300 capitalize">{c.type}</span>
                                    <span className="text-blue-400">·</span>
                                    <span className="text-zinc-600 dark:text-zinc-300">
                                        <span className="font-semibold">{parseInt(c.submitted || 0).toLocaleString()}</span>
                                        <span className="text-zinc-400"> in sitemap</span>
                                    </span>
                                    <span className="text-zinc-400">·</span>
                                    <span className="text-green-700 dark:text-green-400 font-semibold">
                                        {parseInt(c.indexed || 0).toLocaleString()} indexed
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                {/* ── Pending info ── */}
                {details.isPending && (
                    <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-700 dark:text-amber-400 text-sm">Processing by Google</AlertTitle>
                        <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
                            Google is still processing this sitemap. Check back in a few hours.
                        </AlertDescription>
                    </Alert>
                )}

                {/* ── Errors ── */}
                {details.errorDetails && details.errorDetails.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Possible Error Causes</p>
                        <p className="text-[10px] text-zinc-400 -mt-1">
                            The GSC API reports counts only. Click <strong>View in Search Console</strong> above to see the exact affected URLs.
                        </p>
                        {details.errorDetails.map((err, i) => (
                            <div key={i} className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-3 text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
                                        <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span>{err.type}</span>
                                    </div>
                                    {err.count && (
                                        <span className="bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-300 font-black text-[10px] px-2 py-0.5 rounded-full">
                                            {err.count} affected
                                        </span>
                                    )}
                                </div>
                                <p className="text-zinc-700 dark:text-zinc-300 pl-5">{err.description}</p>
                                <div className="pl-5 flex items-start gap-1.5 bg-white dark:bg-zinc-900 rounded p-2 border border-red-100 dark:border-red-900/50">
                                    <Info className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-blue-600 dark:text-blue-400"><span className="font-bold">Fix:</span> {err.fix}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── URL Health Check Content ── */}

                {/* ── URL Health Check ── */}
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">

                    {/* Compact single-bar header */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <AlertCircle className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-widest">URL Health & Indexing Monitor</span>
                            {urlCheck && urlCheck.checkMode === "health" && (
                                <div className="flex items-center gap-1.5 ml-1">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />{urlCheck.summary.ok} OK
                                    </span>
                                    <span className="text-zinc-300 dark:text-zinc-600 select-none">·</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />{urlCheck.summary.redirects} Redirects
                                    </span>
                                    <span className="text-zinc-300 dark:text-zinc-600 select-none">·</span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />{urlCheck.summary.notFound + urlCheck.summary.errors} Issues
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {!urlCheck ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCheckUrls}
                                        disabled={isCheckingUrls || isInspectingUrls}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border-2 border-destructive bg-transparent text-destructive dark:text-red-400 hover:bg-destructive/10 active:scale-95 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        {isCheckingUrls
                                            ? <><Loader2 className="h-3 w-3 animate-spin" /> Checking...</>
                                            : <><AlertCircle className="h-3 w-3" /> Run URL Health Check</>
                                        }
                                    </button>

                                    {isInspectingUrls ? (
                                        <button
                                            onClick={handleStopInspection}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border-2 border-zinc-400 bg-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <XCircle className="h-3.5 w-3.5" /> Stop
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleInspectUrls}
                                            disabled={isCheckingUrls || isInspectingUrls}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border-2 border-blue-500/40 bg-transparent text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 active:scale-95 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                        >
                                            <><Search className="h-3.5 w-3.5" /> Check Indexing Status</>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCheckUrls}
                                        disabled={isCheckingUrls || isInspectingUrls}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border-2 border-destructive/40 bg-transparent text-destructive dark:text-red-400 hover:bg-destructive/10 hover:border-destructive active:scale-95 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${isCheckingUrls ? "animate-spin" : ""}`} />
                                        Run URL Health Check
                                    </button>

                                    {isInspectingUrls ? (
                                        <button
                                            onClick={handleStopInspection}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border-2 border-zinc-400 bg-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <XCircle className="h-3.5 w-3.5" /> Stop
                                        </button>
                                    ) : (
                                        !urlCheck.indexingHidden && (
                                            <button
                                                onClick={handleInspectUrls}
                                                disabled={isCheckingUrls}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md border-2 border-blue-500/40 bg-transparent text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 active:scale-95 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                            >
                                                <><Search className="h-3.5 w-3.5" /> Check Indexing Status</>
                                            </button>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error state */}
                    {urlCheckError && (
                        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-3">
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="font-medium">{urlCheckError}</span>
                        </div>
                    )}

                    {/* Loading */}
                    {isCheckingUrls && !urlCheck && (
                        <div className="flex items-center justify-center gap-2.5 py-8 text-zinc-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs font-medium">Checking URLs, please wait...</span>
                        </div>
                    )}

                    {/* Results table */}
                    {urlCheck && (
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                            {/* Table toolbar: filter pills + count */}
                            <div className="flex items-center gap-3 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto no-scrollbar">
                                <div className="flex items-center gap-2">
                                    {urlCheck.checkMode === "health" ? (
                                        [
                                            { key: "all", label: "All", count: urlCheck.summary.checked, colors: "border-zinc-300 text-zinc-600" },
                                            { key: "error", label: "Issues", count: urlCheck.summary.notFound + urlCheck.summary.errors + urlCheck.summary.redirects, colors: "border-red-300 text-red-600" },
                                            { key: "ok", label: "OK", count: urlCheck.summary.ok, colors: "border-green-300 text-green-600" }
                                        ].map((tab) => {
                                            const isSelected = urlFilter === tab.key;
                                            return (
                                                <button
                                                    key={tab.key}
                                                    onClick={() => setUrlFilter(tab.key)}
                                                    className={`rounded-full text-[10px] font-black uppercase tracking-tight transition-all px-2.5 py-1 whitespace-nowrap cursor-pointer ${isSelected ? `border-2 ${tab.colors} bg-white dark:bg-zinc-900` : "border border-zinc-200 text-zinc-400"
                                                        }`}
                                                >
                                                    {tab.label} {tab.count}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        [
                                            { key: "all", label: "All", count: urlCheck.summary.checked, colors: "border-zinc-300 text-zinc-600" },
                                            { key: "indexed", label: "Indexed", count: urlCheck.summary.indexed || 0, colors: "border-blue-300 text-blue-600" },
                                            { key: "non-indexed", label: "Not Indexed", count: urlCheck.summary.nonIndexed || 0, colors: "border-zinc-300 text-zinc-500" }
                                        ].map((tab) => {
                                            const isSelected = urlFilter === tab.key;
                                            return (
                                                <button
                                                    key={tab.key}
                                                    onClick={() => setUrlFilter(tab.key)}
                                                    className={`rounded-full text-[10px] font-black uppercase tracking-tight transition-all px-2.5 py-1 whitespace-nowrap cursor-pointer ${isSelected ? `border-2 ${tab.colors} bg-white dark:bg-zinc-900` : "border border-zinc-200 text-zinc-400"
                                                        }`}
                                                >
                                                    {tab.label} {tab.count}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                                <span className="ml-auto text-[10px] text-zinc-400 font-bold uppercase tracking-widest hidden sm:block">
                                    {urlCheck.summary.checked}/{urlCheck.summary.total} Scan
                                </span>
                            </div>

                            {/* URL rows */}
                            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                                {urlCheck.urls
                                    .filter((u) => {
                                        if (urlFilter === "ok") return u.category === "ok";
                                        if (urlFilter === "error") return u.category !== "ok";
                                        if (urlFilter === "indexed") return u.inspection?.indexStatus === "INDEXED";
                                        if (urlFilter === "non-indexed") return u.inspection?.indexStatus === "NOT_INDEXED";
                                        return true;
                                    })
                                    .map((u, i) => (
                                        <div key={i} className="flex items-center gap-3 px-3 py-2 group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                            <div className={`h-1.5 w-1.5 rounded-full ${u.category === "ok" ? "bg-green-500" : "bg-red-500"}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-mono text-[11px] truncate text-zinc-600 dark:text-zinc-300" title={u.url}>{u.url}</p>
                                            </div>

                                            {/* Indexing Badge - Right aligned at the end of the row */}
                                            {(urlCheck.checkMode === "indexing" || (u.inspection?.indexStatus && u.inspection.indexStatus !== "UNCHECKED")) && (
                                                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded border ${u.inspection?.indexStatus === "INDEXED"
                                                    ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                                                    : u.inspection?.indexStatus === "NOT_INDEXED"
                                                        ? "bg-zinc-50 text-zinc-400 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800"
                                                        : u.inspection?.indexStatus === "PROCESSING"
                                                            ? "bg-blue-50 text-blue-500 border-blue-200 animate-pulse dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                                                            : "bg-zinc-50 text-zinc-300 border-transparent dark:bg-zinc-900 dark:text-zinc-600"
                                                    }`}>
                                                    {u.inspection?.indexStatus === "INDEXED" ? "INDEXED" : u.inspection?.indexStatus === "NOT_INDEXED" ? "NOT INDEXED" : u.inspection?.indexStatus === "PROCESSING" ? "CHECKING..." : "UNCHECKED"}
                                                </span>
                                            )}

                                            {urlCheck.checkMode === "health" && (
                                                <div className="flex items-center gap-2 ml-auto text-right">
                                                    <span
                                                        className={`text-[11px] font-semibold ${u.category === "ok"
                                                            ? "text-green-600"
                                                            : u.category === "redirect"
                                                                ? "text-yellow-600"
                                                                : "text-red-600"
                                                            }`}
                                                    >
                                                        {u.status} - {u.statusText}
                                                    </span>
                                                    {u.rawResponse && (
                                                        <div className="relative group/tooltip inline-flex items-center">
                                                            <Info className="h-3.5 w-3.5 text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors" />
                                                            {/* Tooltip content: shows below for the first few items (i < 3) and above for others */}
                                                            <div className={`pointer-events-none absolute right-0 min-w-[140px] w-max max-w-[220px] p-2 text-[10px] sm:text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 z-[100] border border-zinc-200 dark:border-zinc-700 text-left ${i < 3 ? "top-full mt-2" : "bottom-full mb-2"
                                                                }`}>
                                                                <div className="flex flex-col gap-1 items-start text-left">
                                                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 pb-0.5 w-full text-left">Raw Response</span>
                                                                    <span className="whitespace-normal leading-relaxed text-left">{u.rawResponse}</span>
                                                                </div>
                                                                {/* Triangle/Arrow */}
                                                                <div className={`absolute right-1 border-4 border-transparent ${i < 3
                                                                    ? "bottom-full border-b-zinc-100 dark:border-b-zinc-800"
                                                                    : "top-full border-t-zinc-100 dark:border-t-zinc-800"
                                                                    }`} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                {urlCheck.urls.filter((u) => {
                                    if (urlFilter === "ok") return u.category === "ok";
                                    if (urlFilter === "error") return u.category !== "ok";
                                    if (urlFilter === "indexed") return u.inspection?.indexStatus === "INDEXED";
                                    if (urlFilter === "non-indexed") return u.inspection?.indexStatus === "NOT_INDEXED";
                                    return true;
                                }).length === 0 && (
                                        <div className="flex items-center justify-center gap-2 py-8 text-zinc-400">
                                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                                            <span className="text-xs font-medium">No URLs match this filter</span>
                                        </div>
                                    )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}

// ─── Health Report Modal ────────────────────────────────────────────────────────
function HealthReportModal({ sitemapId, feedpath, isOpen, onClose }) {
    const [log, setLog] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && sitemapId) {
            fetchLog();
        }
    }, [isOpen, sitemapId]);

    const fetchLog = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/sitemap/health-check/log?sitemapId=${sitemapId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch health log");
            setLog(data.log);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
                    <div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Sitemap Health Report</h3>
                        <p className="text-xs text-zinc-400 mt-0.5 font-mono truncate max-w-md">{feedpath}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Loading diagnostics...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <ShieldAlert className="h-12 w-12 text-red-200 mb-4" />
                            <p className="text-sm font-bold text-red-600 uppercase tracking-tight">Analysis Unavailable</p>
                            <p className="text-xs text-zinc-500 max-w-xs mt-2">{error}</p>
                            <Button variant="outline" size="sm" onClick={fetchLog} className="mt-6 font-bold border-2">Retry Scan</Button>
                        </div>
                    ) : (log && log.status === "PROCESSING") ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="relative">
                                <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
                                <Clock className="h-5 w-5 text-amber-600 absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-amber-600 uppercase tracking-widest">Scan in Progress</p>
                                <p className="text-xs text-zinc-500 mt-2 max-w-[280px]">We're currently verifying the health of all URLs in this sitemap. This may take a moment.</p>
                            </div>
                        </div>
                    ) : log ? (
                        <div className="space-y-8">
                            {/* Scoreboard */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 text-center">Accessible</p>
                                    <p className={`text-xl font-black text-center ${log.summary.accessible ? 'text-green-600' : 'text-red-600'}`}>
                                        {log.summary.accessible ? 'YES' : 'NO'}
                                    </p>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 text-center">XML Valid</p>
                                    <p className={`text-xl font-black text-center ${log.summary.xmlValid ? 'text-green-600' : 'text-red-600'}`}>
                                        {log.summary.xmlValid ? 'YES' : 'NO'}
                                    </p>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 text-center">Total URLs</p>
                                    <p className="text-xl font-black text-center text-zinc-900 dark:text-zinc-100">
                                        {log.summary.totalUrls}
                                    </p>
                                </div>
                                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 text-center">Response</p>
                                    <p className="text-xl font-black text-center text-zinc-900 dark:text-zinc-100">
                                        {log.summary.responseTimeMs}ms
                                    </p>
                                </div>
                            </div>

                            {/* Detailed Errors */}
                            {log.errors.length > 0 ? (
                                <div className="space-y-3">
                                    <h4 className="text-[11px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        Critical Issues ({log.errors.length})
                                    </h4>
                                    <div className="rounded-xl border border-red-100 dark:border-red-900/30 overflow-hidden divide-y divide-red-50 dark:divide-red-900/20">
                                        {log.errors.map((err, i) => (
                                            <div key={i} className="p-3 flex items-start justify-between gap-4 bg-red-50/10 hover:bg-red-50/30 transition-colors">
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate mb-0.5" title={err.url}>{err.url}</p>
                                                    <p className="text-xs font-bold text-red-700 dark:text-red-400">{err.type} {err.code ? `(${err.code})` : ''}</p>
                                                </div>
                                                <span className="text-[10px] font-black bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    {err.type}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 bg-green-50/30 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                                    <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
                                    <p className="text-sm font-black text-green-700 dark:text-green-400 uppercase tracking-tight">Sitemap is Healthy</p>
                                    <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">No critical accessibility or formatting issues detected.</p>
                                </div>
                            )}

                            {/* Recommendations if Errors */}
                            {log.errors.length > 0 && (
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-4 w-4 text-blue-500" />
                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Recommended Actions</span>
                                    </div>
                                    <ul className="text-xs text-blue-600 dark:text-blue-300 space-y-1.5 list-disc pl-4 font-medium leading-relaxed">
                                        <li>Fix broken links returning 4xx or 5xx status codes to ensure Google can crawl them.</li>
                                        <li>Check your server's robots.txt to make sure it's not blocking sitemap access.</li>
                                        <li>Verify that the XML structure strictly follows the sitemaps.org protocol.</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-zinc-400 font-bold uppercase tracking-widest italic">No diagnostics available.</div>
                    )}
                </div>

                <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
                    <Button variant="outline" size="sm" onClick={onClose} className="font-bold border-2">Dismiss</Button>
                    {log && (
                        <Button size="sm" onClick={() => window.open(`https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(log.siteUrl || '')}`, '_blank')} className="font-bold bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black shadow-lg shadow-black/5">
                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                            GSC Dashboard
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sitemaps Table ───────────────────────────────────────────────────────────
function SitemapsTable({ sitemaps, siteUrl, onRefresh, isRefreshing, lastRefreshed }) {
    const [expandedRow, setExpandedRow] = useState(null);
    const [reportModal, setReportModal] = useState({ isOpen: false, sitemapId: null, feedpath: "" });

    const toggleRow = (path) => {
        setExpandedRow((prev) => (prev === path ? null : path));
    };

    if (sitemaps.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-60">
                <Map className="h-8 w-8 mb-2" />
                <p className="text-sm">No sitemaps submitted yet for this property.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {sitemaps.map((sm) => (
                <div key={sm.path} className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                    {/* Main row */}
                    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex-1 min-w-0 mr-4">
                            <p className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 truncate" title={sm.path}>
                                {sm.path}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                                <span className="flex items-center gap-1">
                                    <Send className="h-3 w-3" />
                                    Submitted: {formatDate(sm.lastSubmitted)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    Last Read: {formatDate(sm.lastDownloaded)}
                                </span>
                                {sm.lastHealthCheckAt && (
                                    <span className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold">
                                        <Clock className="h-2.5 w-2.5" />
                                        Checked: {new Date(sm.lastHealthCheckAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                            {/* Health Status Dashboard UI */}
                            <div className="flex flex-col items-end gap-1.5">
                                <div className="flex items-center gap-2">
                                    {sm.healthStatus === "PROCESSING" ? (
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full animate-pulse">
                                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing
                                        </span>
                                    ) : sm.healthStatus === "ERROR" ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setReportModal({ isOpen: true, sitemapId: sm._id || sm.path, feedpath: sm.path });
                                            }}
                                            className="cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900/50 hover:bg-red-100 transition-colors"
                                        >
                                            <ShieldAlert className="h-3 w-3" /> {sm.localErrorCount} Error{sm.localErrorCount !== 1 ? 's' : ''}
                                        </button>
                                    ) : sm.healthStatus === "ACTIVE" ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setReportModal({ isOpen: true, sitemapId: sm._id || sm.path, feedpath: sm.path });
                                            }}
                                            className="cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full border border-green-100 dark:border-green-900/50 hover:bg-green-100 transition-colors"
                                        >
                                            <CheckCircle2 className="h-3 w-3" /> Healthy
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            {/* Discovered (web URLs in sitemap) */}
                            <div className="text-center hidden md:block">
                                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Discovered</p>
                                <p className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                                    {(sm.webSubmitted || 0).toLocaleString()}
                                </p>
                            </div>
                            {/* Indexed (web URLs indexed by Google) */}
                            <div className="text-center hidden md:block">
                                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Indexed</p>
                                <p className={`text-sm font-black ${sm.webIndexed > 0 ? "text-green-600 dark:text-green-400" : "text-zinc-400"}`}>
                                    {(sm.webIndexed || 0).toLocaleString()}
                                </p>
                            </div>
                            {sm.healthStatus !== "PROCESSING" && (
                                <StatusBadge
                                    statusLabel={sm.statusLabel}
                                    errors={sm.errorLogs}
                                    warnings={sm.warnings}
                                />
                            )}
                            <button
                                onClick={() => toggleRow(sm.path)}
                                className="cursor-pointer text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                title={expandedRow === sm.path ? "Collapse details" : "Expand details"}
                                aria-label={expandedRow === sm.path ? "Collapse sitemap details" : "Expand sitemap details"}
                                aria-expanded={expandedRow === sm.path}
                            >
                                {expandedRow === sm.path
                                    ? <ChevronUp className="h-4 w-4" />
                                    : <ChevronDown className="h-4 w-4" />
                                }
                            </button>
                        </div>
                    </div>

                    {/* Expandable detail panel */}
                    {expandedRow === sm.path && (
                        <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/40">
                            <ErrorDetailPanel siteUrl={siteUrl} feedpath={sm.path} localHealthStatus={sm.healthStatus} />
                        </div>
                    )}
                </div>
            ))}

            <HealthReportModal
                isOpen={reportModal.isOpen}
                sitemapId={reportModal.sitemapId}
                feedpath={reportModal.feedpath}
                onClose={() => setReportModal({ ...reportModal, isOpen: false })}
            />
        </div>
    );
}

// ─── Validation Result Banner ─────────────────────────────────────────────────
function ValidationResult({ result }) {
    if (!result) return null;
    if (result.valid) {
        return (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 dark:text-green-400 text-sm">Sitemap Validated</AlertTitle>
                <AlertDescription className="text-xs text-green-600 dark:text-green-400 space-y-1">
                    <p>Sitemap is reachable and structurally valid.</p>
                    {result.stats && (
                        <div className="flex gap-3 mt-2 flex-wrap">
                            <span className="bg-green-100 dark:bg-green-900/40 rounded px-2 py-0.5 font-semibold">
                                {result.stats.totalUrls.toLocaleString()} URLs
                            </span>
                            <span className="bg-green-100 dark:bg-green-900/40 rounded px-2 py-0.5 font-semibold">
                                {result.stats.fileSizeKB} KB
                            </span>
                            {result.stats.isSitemapIndex && (
                                <span className="bg-blue-100 dark:bg-blue-900/40 rounded px-2 py-0.5 text-blue-700 font-semibold">
                                    Sitemap Index
                                </span>
                            )}
                        </div>
                    )}
                    {result.warnings && result.warnings.length > 0 && (
                        <ul className="mt-2 space-y-1 list-disc pl-4 text-amber-600 dark:text-amber-400">
                            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    )}
                </AlertDescription>
            </Alert>
        );
    }
    return (
        <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-700 dark:text-red-400 text-sm">Validation Failed</AlertTitle>
            <AlertDescription className="text-xs text-red-600 dark:text-red-400 space-y-1">
                <ul className="list-disc pl-4 space-y-1">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
                {result.warnings && result.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-amber-600 dark:text-amber-400">
                        {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                )}
            </AlertDescription>
        </Alert>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SitemapPage() {
    const {
        indexingStatus,
        connectedSitesCount,
        verifiedSites,
        activeWebsite,
        setActiveWebsite,
        isLoading: isConnectionLoading,
    } = useConnection();

    const activeVerifiedSites = useMemo(
        () => (verifiedSites || []).filter((s) => s.status === "SUCCESS"),
        [verifiedSites]
    );

    const isServiceAccountValid = connectedSitesCount > 0;

    // Rule: Reset pill selection if connected websites change AND selected site is no longer valid
    useEffect(() => {
        if (activeWebsite && !activeVerifiedSites.find(s => s.url === activeWebsite)) {
            setActiveWebsite(null);
        }
    }, [activeVerifiedSites, activeWebsite, setActiveWebsite]);

    // -- Submit form state --
    const [sitemapUrl, setSitemapUrl] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [submitResult, setSubmitResult] = useState(null);

    // -- Sitemaps list state --
    const [sitemaps, setSitemaps] = useState([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [listError, setListError] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [notification, setNotification] = useState(null);
    const prevSitemapsRef = useRef([]);

    // Detect changes in sitemaps to trigger notifications
    useEffect(() => {
        if (sitemaps.length > 0 && prevSitemapsRef.current.length > 0) {
            sitemaps.forEach(currentSm => {
                const prevSm = prevSitemapsRef.current.find(sm => sm._id === currentSm._id);
                // Detection logic: status changes from PROCESSING to something else
                if (prevSm && prevSm.healthStatus === "PROCESSING" && currentSm.healthStatus !== "PROCESSING") {
                    if (currentSm.healthStatus === "ERROR") {
                        setNotification({
                            type: "error",
                            text: `The sitemap ${currentSm.feedpath} contains errors. The detailed error report has been sent to the configured email address.`
                        });
                    } else if (currentSm.healthStatus === "ACTIVE") {
                        setNotification({
                            type: "success",
                            text: `Sitemap ${currentSm.feedpath} processed successfully with no errors.`
                        });
                    }
                }
            });
        }
        prevSitemapsRef.current = sitemaps;
    }, [sitemaps]);

    // Auto-dismiss notification after 10 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Pill colour palette (mirrors indexing page)
    const pillColors = [
        { border: "border-blue-400", selectBorder: "border-blue-600", text: "text-blue-600", hover: "hover:border-blue-600" },
        { border: "border-purple-400", selectBorder: "border-purple-600", text: "text-purple-600", hover: "hover:border-purple-600" },
        { border: "border-indigo-400", selectBorder: "border-indigo-600", text: "text-indigo-600", hover: "hover:border-indigo-600" },
        { border: "border-teal-400", selectBorder: "border-teal-600", text: "text-teal-600", hover: "hover:border-teal-600" },
        { border: "border-emerald-400", selectBorder: "border-emerald-600", text: "text-emerald-600", hover: "hover:border-emerald-600" },
    ];

    // Fetch sitemaps list
    const fetchSitemaps = useCallback(async (site = activeWebsite) => {
        if (!site) return;
        setIsLoadingList(true);
        setListError(null);
        try {
            const res = await fetch(`/api/sitemap/list?siteUrl=${encodeURIComponent(site)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load sitemaps");
            setSitemaps(data.sitemaps || []);
            setLastRefreshed(new Date());
        } catch (err) {
            setListError(err.message);
        } finally {
            setIsLoadingList(false);
        }
    }, [activeWebsite]);

    // Validate sitemap URL
    const handleValidate = async () => {
        if (!sitemapUrl.trim()) return;
        setIsValidating(true);
        setValidationResult(null);
        setSubmitResult(null);
        try {
            const res = await fetch("/api/sitemap/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sitemapUrl: sitemapUrl.trim(), siteUrl: activeWebsite }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Validation request failed");
            setValidationResult(data);
        } catch (err) {
            setValidationResult({ valid: false, errors: [err.message], warnings: [] });
        } finally {
            setIsValidating(false);
        }
    };

    // Submit sitemap
    const handleSubmit = async () => {
        if (!activeWebsite || !sitemapUrl.trim() || !validationResult?.valid) return;
        setIsSubmitting(true);
        setSubmitResult(null);
        try {
            const res = await fetch("/api/sitemap/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ siteUrl: activeWebsite, feedpath: sitemapUrl.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Submission failed");
            setSubmitResult({ success: true, message: data.message });
            // Refresh list after successful submission
            setTimeout(() => fetchSitemaps(activeWebsite), 1500);
        } catch (err) {
            setSubmitResult({ success: false, message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset on website change
    useEffect(() => {
        if (activeWebsite && isServiceAccountValid && indexingStatus !== "DISCONNECTED") {
            setSitemapUrl("");
            setValidationResult(null);
            setSubmitResult(null);
            fetchSitemaps(activeWebsite);
        } else {
            setSitemaps([]);
            setLastRefreshed(null);
        }
    }, [activeWebsite, isServiceAccountValid, indexingStatus, fetchSitemaps]);

    // -- Polling for Processing Sitemaps --
    useEffect(() => {
        if (!activeWebsite || sitemaps.length === 0) return;

        const hasProcessing = sitemaps.some(sm => sm.healthStatus === "PROCESSING");
        if (!hasProcessing) return;

        const pollInterval = setInterval(() => {
            fetchSitemaps(activeWebsite);
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [activeWebsite, sitemaps, fetchSitemaps]);

    // Force clear all sitemap data if connection is lost
    useEffect(() => {
        if (!isServiceAccountValid || indexingStatus === "DISCONNECTED") {
            setSitemaps([]);
            setSitemapUrl("");
            setValidationResult(null);
            setSubmitResult(null);
            setActiveWebsite(null);
            setListError(null);
            setLastRefreshed(null);
        }
    }, [isServiceAccountValid, indexingStatus, setActiveWebsite]);

    const isGlobalDisabled =
        !activeWebsite ||
        !isServiceAccountValid ||
        indexingStatus === "DISCONNECTED" ||
        isConnectionLoading;

    const canSubmit =
        validationResult?.valid &&
        !isSubmitting &&
        !isGlobalDisabled;

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            {notification && (
                <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm animate-in fade-in slide-in-from-right-full duration-500">
                    <Alert
                        variant={notification.type === "success" ? "default" : "destructive"}
                        className={cn(
                            "shadow-2xl border-2",
                            notification.type === "success"
                                ? "border-emerald-500 bg-white text-emerald-900"
                                : "border-red-500 bg-white text-red-900"
                        )}
                    >
                        <div className="flex items-start gap-4">
                            <div className="mt-1">
                                {notification.type === "success" ? (
                                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                ) : (
                                    <AlertCircle className="h-6 w-6 text-red-600" />
                                )}
                            </div>
                            <div className="flex-1 space-y-1">
                                <AlertTitle className="font-black uppercase tracking-tight text-sm">
                                    {notification.type === "success" ? "Success" : "Sitemap Error"}
                                </AlertTitle>
                                <AlertDescription className="text-xs font-medium leading-relaxed opacity-90">
                                    {notification.text}
                                </AlertDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setNotification(null)}
                                className="h-6 w-6 p-0 hover:bg-zinc-100 rounded-full shrink-0"
                            >
                                <X className="h-4 w-4 text-zinc-400" />
                                <span className="sr-only">Dismiss</span>
                            </Button>
                        </div>
                    </Alert>
                </div>
            )}

            {/* ── No credentials state ── */}
            {!isServiceAccountValid && !isConnectionLoading && (
                <div className="flex flex-col items-center justify-center py-20 bg-zinc-50/50 rounded-2xl border-2 border-dashed border-zinc-200 animate-in fade-in slide-in-from-top-4">
                    <ShieldAlert className="h-12 w-12 text-zinc-300 mb-4" />
                    <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tight text-center">No Service Account connected</h3>
                    <p className="text-sm text-muted-foreground max-w-sm text-center mt-2 mb-6">
                        Please connect credentials to view submitted sitemaps.
                    </p>
                    <Button variant="outline" size="sm" asChild className="font-bold border-2">
                        <a href="/dashboard/credentials" className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4" />
                            Upload Credentials
                        </a>
                    </Button>
                </div>
            )}

            {/* ── Property Pills ── */}
            {isServiceAccountValid && (indexingStatus === "CONNECTED" || indexingStatus === "PARTIAL") && activeVerifiedSites.length > 0 && !isConnectionLoading && (
                <div className="space-y-3">
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
                            Current scope: <span className={`font-extrabold uppercase tracking-tight ${pillColors[activeVerifiedSites.findIndex(s => s.url === activeWebsite) % pillColors.length]?.text || "text-zinc-600"}`}>{activeWebsite}</span>
                        </p>
                    )}
                </div>
            )}

            {/* ── Main content (Always visible, but disabled if invalid) ── */}
            <div className={`space-y-6 transition-all duration-300 ${(!isServiceAccountValid || indexingStatus === "DISCONNECTED" || !activeWebsite || isConnectionLoading) ? "opacity-40 pointer-events-none grayscale" : ""}`}>

                {/* ── Page header ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                    <div className="flex flex-col space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight">
                            Sitemap Submission
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Submit, monitor, and troubleshoot sitemaps via Google Search Console API.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* ════════════════════════════════════════════════ */}
                    {/* SECTION 1 — Submit New Sitemap                   */}
                    {/* ════════════════════════════════════════════════ */}
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Send className="h-4 w-4 text-blue-500" />
                                Submit New Sitemap
                            </CardTitle>
                            <CardDescription>
                                Enter the full URL of your sitemap. Validation runs before submission.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                    Sitemap URL
                                </label>
                                <Input
                                    placeholder="https://example.com/sitemap.xml"
                                    value={sitemapUrl}
                                    onChange={(e) => {
                                        setSitemapUrl(e.target.value);
                                        setValidationResult(null);
                                        setSubmitResult(null);
                                    }}
                                    className="font-mono text-sm"
                                    disabled={isGlobalDisabled}
                                />
                                <p className="text-[11px] text-zinc-400">
                                    Must be an absolute URL. The sitemap must be publicly accessible.
                                </p>
                            </div>

                            {/* Validation result */}
                            <ValidationResult result={validationResult} />

                            {/* Submit result */}
                            {submitResult && (
                                <Alert className={submitResult.success
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                                }>
                                    {submitResult.success
                                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        : <XCircle className="h-4 w-4 text-red-600" />
                                    }
                                    <AlertTitle className={`text-sm ${submitResult.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                                        {submitResult.success ? "Sitemap Submitted" : "Submission Failed"}
                                    </AlertTitle>
                                    <AlertDescription className={`text-xs ${submitResult.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                        {submitResult.message}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                        <CardFooter className="flex gap-3">
                            {/* Validate — only shown when not validated yet */}
                            {!validationResult?.valid && (
                                <Button
                                    variant="outline"
                                    className="flex-1 font-bold uppercase tracking-widest text-xs h-10 border-2"
                                    onClick={handleValidate}
                                    disabled={!sitemapUrl.trim() || isValidating || isGlobalDisabled}
                                >
                                    {isValidating
                                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating...</>
                                        : <><AlertCircle className="mr-2 h-4 w-4" /> Validate</>
                                    }
                                </Button>
                            )}
                            {/* Submit — only shown after a successful validation */}
                            {validationResult?.valid && (
                                <Button
                                    variant="destructive"
                                    className="flex-1 font-bold uppercase tracking-widest text-xs h-10 shadow-md hover:shadow-lg active:scale-95 transition-all"
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                >
                                    {isSubmitting
                                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                                        : <><Send className="mr-2 h-4 w-4" /> Submit Sitemap</>
                                    }
                                </Button>
                            )}
                        </CardFooter>
                    </Card>

                    {/* ════════════════════════════════════════════════ */}
                    {/* SECTION 2 — Quick guide                          */}
                    {/* ════════════════════════════════════════════════ */}
                    <Card className="h-fit bg-gradient-to-br from-blue-50/60 to-indigo-50/60 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-100 dark:border-blue-900/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base text-blue-800 dark:text-blue-300">
                                <Info className="h-4 w-4" />
                                How it works
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-blue-900 dark:text-blue-200">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center mt-0.5">1</div>
                                <div>
                                    <p className="font-semibold">Select a Property</p>
                                    <p className="text-xs text-blue-700/70 dark:text-blue-300/70">Choose a verified GSC property from the pills above.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center mt-0.5">2</div>
                                <div>
                                    <p className="font-semibold">Enter Sitemap URL</p>
                                    <p className="text-xs text-blue-700/70 dark:text-blue-300/70">Enter the full sitemap URL (e.g., https://example.com/sitemap.xml).</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center mt-0.5">3</div>
                                <div>
                                    <p className="font-semibold">Validate First</p>
                                    <p className="text-xs text-blue-700/70 dark:text-blue-300/70">Click Validate to check URL format, reachability, and XML structure before submitting.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center mt-0.5">4</div>
                                <div>
                                    <p className="font-semibold">Submit to Google</p>
                                    <p className="text-xs text-blue-700/70 dark:text-blue-300/70">After validation passes, submit to GSC. Google will start crawling your sitemap.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center mt-0.5">5</div>
                                <div>
                                    <p className="font-semibold">Monitor Status</p>
                                    <p className="text-xs text-blue-700/70 dark:text-blue-300/70">Check the table below and expand any sitemap row to view errors and warnings.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ════════════════════════════════════════════════════ */}
                {/* SECTION 3 — Submitted Sitemaps List                  */}
                {/* ════════════════════════════════════════════════════ */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2.5 text-base">
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    Submitted Sitemaps
                                    {sitemaps.length > 0 && (
                                        <span className="inline-flex items-center rounded-full text-xs font-bold bg-secondary text-secondary-foreground leading-none" style={{ padding: "10px" }}>
                                            {sitemaps.length} Submitted Sitemap{sitemaps.length !== 1 ? "s" : ""} Found
                                        </span>
                                    )}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    {lastRefreshed
                                        ? `Last refreshed: ${lastRefreshed.toLocaleTimeString()}`
                                        : "Sitemaps for the selected property"
                                    }
                                </CardDescription>
                            </div>
                            {/* Buttons — right-aligned */}
                            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                                {/* View in Search Console — common button */}
                                {activeWebsite && (
                                    <a
                                        href={`https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(activeWebsite)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="View sitemaps in Google Search Console"
                                        className="cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-md border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
                                    >
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.088 13.37l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.728.216z" />
                                        </svg>
                                        View in Search Console
                                    </a>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 font-bold text-xs border-2"
                                    onClick={() => fetchSitemaps()}
                                    disabled={isLoadingList || !activeWebsite}
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingList ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingList ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                <span className="text-sm">Loading sitemaps...</span>
                            </div>
                        ) : listError ? (
                            <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-700 dark:text-red-400 text-sm">Failed to Load Sitemaps</AlertTitle>
                                <AlertDescription className="text-xs text-red-600 dark:text-red-400">{listError}</AlertDescription>
                            </Alert>
                        ) : (
                            <SitemapsTable
                                sitemaps={sitemaps}
                                siteUrl={activeWebsite}
                                onRefresh={fetchSitemaps}
                                isRefreshing={isLoadingList}
                                lastRefreshed={lastRefreshed}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
