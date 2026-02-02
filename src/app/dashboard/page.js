import { auth } from "@/auth";
import { DashboardStats } from "@/components/dashboard-stats";
import { ConnectionStatusBadge } from "@/components/connection-status-badge";

export default async function DashboardPage() {
    const session = await auth();
    const firstName = session?.user?.firstName;

    // Get time-aware greeting
    const hour = new Date().getHours();
    let greeting = "Good evening";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";

    const Breadcrumbs = () => (
        <nav className="flex mb-2" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
                <li className="inline-flex items-center">
                    <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Overview
                    </span>
                </li>
            </ol>
        </nav>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-8">
                <div className="flex items-start gap-5">
                    {/* Premium Avatar/Icon */}
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative h-16 w-16 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center shadow-sm overflow-hidden">
                            <div className="absolute inset-0 bg-emerald-50/50 dark:bg-emerald-900/10" />
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 relative">
                                {firstName ? firstName.charAt(0).toUpperCase() : session?.user?.email?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 shadow-sm" />
                    </div>

                    <div className="flex flex-col">
                        <Breadcrumbs />
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">
                            {greeting}{firstName ? `, ${firstName}!` : '!'}
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
                            <span>Logged in as <span className="text-emerald-600 dark:text-emerald-400 font-bold">{session?.user?.email}</span></span>
                            <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                            <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">System Status</span>
                    <ConnectionStatusBadge />
                </div>
            </div>

            <DashboardStats />
        </div>
    );
}
