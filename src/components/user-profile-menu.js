"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import {
    LogOut,
    Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserProfileMenu({ user }) {
    const roleLabel = user?.role?.toLowerCase() === 'admin' ? 'Administrator' : 'User';

    return (
        <div className="flex flex-col p-4 border-t border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-800 space-y-4">
            {/* 1. User Info Section */}
            <div className="flex flex-col gap-0 p-3 rounded-lg border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-all">

                {/* Row 1: Account + Edit Icon */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 ring-2 ring-emerald-50 dark:ring-emerald-900/10">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>

                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none">
                                Account
                            </span>
                            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200 truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {/* Pencil Icon Only */}
                    <Link
                        href="/dashboard/edit-profile"
                        className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition active:scale-95"
                        title="Edit Profile"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {/* Row 2: Permission Level */}
                <div className="pl-10">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none">
                        Permission Level
                    </span>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {roleLabel}
                    </p>
                </div>
            </div>

            {/* 2. Sign Out Section (Top of the menu) */}
            <div className="w-full">
                <Button
                    variant="destructive"
                    size="sm"
                    className="w-full justify-start gap-2 h-9 text-xs font-bold shadow-sm shadow-red-100 dark:shadow-none transition-all active:scale-[0.98]"
                    onClick={() => signOut({ redirectTo: "/login" })}
                >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                </Button>
            </div>
        </div>
    );
}
