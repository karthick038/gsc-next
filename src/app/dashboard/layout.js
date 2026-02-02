import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { UserProfileMenu } from "@/components/user-profile-menu";
import { SidebarNav } from "@/components/sidebar-nav";
import Image from "next/image";
import Link from "next/link";
import { ConnectionProvider } from "@/hooks/use-connection";
import { getSettings } from "@/lib/settings";

export default async function DashboardLayout({ children }) {
    const session = await auth();
    const settings = await getSettings();

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-zinc-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 flex flex-col">
                <div className="p-6 border-b border-gray-200 dark:border-zinc-700">
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                        <img
                            src={settings.logoUrl || "/images/branding/colorwhistle-logo.png"}
                            alt="Dashboard Logo"
                            style={{
                                width: settings.logoWidth ? `${settings.logoWidth}px` : 'auto',
                                height: settings.logoHeight ? `${settings.logoHeight}px` : 'auto',
                                maxWidth: '160px',
                                maxHeight: '45px',
                                objectFit: 'contain'
                            }}
                        />
                    </Link>
                </div>

                <SidebarNav role={session?.user?.role} />

                <UserProfileMenu user={session?.user} />
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-8">
                <ConnectionProvider>
                    {children}
                </ConnectionProvider>
            </main>
        </div>
    );
}
