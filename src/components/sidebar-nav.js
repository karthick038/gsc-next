"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, KeyRound, Radio, History as HistoryIcon, Users, Settings as SettingsIcon, Map, Calendar } from "lucide-react";

const USER_LINKS = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/credentials", label: "Service Account Credentials", icon: KeyRound },
    { href: "/dashboard/indexing", label: "Indexing Request", icon: Radio },
    { href: "/dashboard/history", label: "Submission History", icon: HistoryIcon },
    { href: "/dashboard/sitemap", label: "Sitemap Submission", icon: Map },
];

const ADMIN_LINKS = [
    ...USER_LINKS,
    { href: "/admin/dashboard", label: "User Management", icon: Users },
    { href: "/admin/sitemap-scheduler", label: "Sitemap Automation", icon: Calendar },
    { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function SidebarNav({ role }) {
    const pathname = usePathname();
    const userRole = role?.toLowerCase();
    const isAdmin = userRole === "admin";
    const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

    return (
        <nav className="flex-1 p-4 space-y-2">
            {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                    <Link key={link.href} href={link.href} passHref>
                        <Button
                            variant={isActive ? "secondary" : "ghost"}
                            className={`w-full justify-start gap-2 cursor-pointer transition-all ${isActive ? "bg-zinc-100 dark:bg-zinc-700 font-bold text-zinc-900" : "text-zinc-500 font-medium hover:bg-zinc-50"}`}
                        >
                            <Icon className={`h-4 w-4 ${isActive ? "text-zinc-900" : "text-zinc-400"}`} />
                            {link.label}
                        </Button>
                    </Link>
                );
            })}
        </nav>
    );
}
