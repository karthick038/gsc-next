"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ConnectionContext = createContext({
    indexingStatus: "UNKNOWN",
    connectedSitesCount: 0,
    sitesWithPermission: 0,
    sitesWithoutPermission: 0,
    verifiedSites: [],
    activeWebsite: null,
    userEmail: "",
    setActiveWebsite: () => { },
    isLoading: true,
    refreshStatus: async () => { }
});

export function ConnectionProvider({ children }) {
    const [userEmail, setUserEmail] = useState("");
    const [indexingStatus, setIndexingStatus] = useState("UNKNOWN");
    const [connectedSitesCount, setConnectedSitesCount] = useState(0);
    const [sitesWithPermission, setSitesWithPermission] = useState(0);
    const [sitesWithoutPermission, setSitesWithoutPermission] = useState(0);
    const [verifiedSites, setVerifiedSites] = useState([]);
    const [activeWebsite, setActiveWebsite] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/sites");
            if (res.ok) {
                const data = await res.json();
                setUserEmail(data.email || "");
                setIndexingStatus(data.indexingStatus || "DISCONNECTED");
                setConnectedSitesCount(data.connectedSitesCount || 0);
                setSitesWithPermission(data.sitesWithPermission || 0);
                setSitesWithoutPermission(data.sitesWithoutPermission || 0);
                setVerifiedSites(data.verifiedSites || []);
            } else {
                setIndexingStatus("DISCONNECTED");
            }
        } catch (error) {
            console.error("Failed to fetch connection status:", error);
            setIndexingStatus("DISCONNECTED");
            setConnectedSitesCount(0);
            setSitesWithPermission(0);
            setSitesWithoutPermission(0);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        setIndexingStatus("DISCONNECTED");
        setConnectedSitesCount(0);
        setSitesWithPermission(0);
        setSitesWithoutPermission(0);
        setVerifiedSites([]);
        setActiveWebsite(null);
        setUserEmail("");
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return (
        <ConnectionContext.Provider value={{
            indexingStatus,
            connectedSitesCount,
            sitesWithPermission,
            sitesWithoutPermission,
            verifiedSites,
            activeWebsite,
            userEmail,
            setActiveWebsite,
            isLoading,
            refreshStatus: fetchStatus,
            disconnect
        }}>
            {children}
        </ConnectionContext.Provider>
    );
}

export function useConnection() {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error("useConnection must be used within a ConnectionProvider");
    }
    return context;
}
