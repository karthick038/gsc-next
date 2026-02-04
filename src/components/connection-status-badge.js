"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useConnection } from "@/hooks/use-connection";

export function ConnectionStatusBadge() {
    const { indexingStatus, isLoading } = useConnection();

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 animate-pulse">
                <div className="h-2 w-2 rounded-full bg-zinc-400" />
                <span className="text-xs font-medium text-muted-foreground">Checking connection...</span>
            </div>
        );
    }

    const isConnected = indexingStatus === "CONNECTED" || indexingStatus === "PARTIAL";

    return (
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-colors ${isConnected
            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400"
            : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900 dark:text-amber-400"
            }`}>
            {isConnected ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span className="text-sm font-medium">
                Google Search Console Status : <span className="font-bold">{isConnected ? "Connected" : "Disconnected"}</span>
            </span>
        </div>
    );
}
