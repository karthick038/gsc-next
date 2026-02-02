"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, KeyRound, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardSidebar({ userEmail, signOutAction }) {
    const pathname = usePathname();

    const isActive = (path) => {
        return pathname === path;
    };

    const activeClass = "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-50 font-semibold border-l-4 border-l-black dark:border-l-white rounded-l-none";
    const inactiveClass = "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent";

    return (
        <aside className="w-64 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 flex flex-col h-full">
            <div className="p-6 border-b border-gray-200 dark:border-zinc-700">
                <h2 className="text-xl font-bold tracking-tight">MyApp</h2>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                <Link href="/dashboard" className="block">
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start gap-2 h-10 px-4",
                            isActive("/dashboard") ? activeClass : inactiveClass
                        )}
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Overview
                    </Button>
                </Link>
                <Link href="/dashboard/credentials" className="block">
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start gap-2 h-10 px-4",
                            isActive("/dashboard/credentials") ? activeClass : inactiveClass
                        )}
                    >
                        <KeyRound className="h-4 w-4" />
                        Service Account Credentials
                    </Button>
                </Link>
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold">
                        {userEmail?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">{userEmail}</p>
                    </div>
                </div>
                <form action={signOutAction}>
                    <Button variant="destructive" className="w-full justify-start gap-2 cursor-pointer">
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </Button>
                </form>
            </div>
        </aside>
    );
}
