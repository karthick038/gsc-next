"use client";

import React, { useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

const TabsContext = createContext(null);

export function Tabs({ defaultValue, onValueChange, children, className }) {
    const [activeTab, setActiveTab] = useState(defaultValue);

    const handleTabChange = (value) => {
        setActiveTab(value);
        if (onValueChange) onValueChange(value);
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
            <div className={cn("w-full", className)}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, className }) {
    return (
        <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-zinc-100 p-1 text-muted-foreground dark:bg-zinc-800", className)}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, children, className, onClick }) {
    const { activeTab, setActiveTab } = useContext(TabsContext);
    const isActive = activeTab === value;

    return (
        <button
            onClick={(e) => {
                setActiveTab(value);
                if (onClick) onClick(e);
            }}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                isActive
                    ? "bg-white text-foreground shadow-sm dark:bg-zinc-950"
                    : "hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100",
                className
            )}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, children, className }) {
    const { activeTab } = useContext(TabsContext);
    if (activeTab !== value) return null;

    return (
        <div className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}>
            {children}
        </div>
    );
}
