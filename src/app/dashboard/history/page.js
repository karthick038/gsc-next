"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, Filter, User } from "lucide-react";

import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

function getResponseText(statusCode, response) {
    if (statusCode === 200) {
        return "Success";
    }

    if (!response) return "Unknown error";

    let data = response;

    // If response is a string, try to parse it
    if (typeof response === 'string') {
        try {
            data = JSON.parse(response);
        } catch (e) {
            return response;
        }
    }

    // Hande object response
    if (typeof data === 'object') {
        // Direct message field
        if (data.message) return data.message;

        // Nested error object (Google API standard)
        if (data.error) {
            if (typeof data.error === 'object' && data.error.message) {
                return data.error.message;
            }
            if (typeof data.error === 'string') {
                return data.error;
            }
        }
    }

    return "Unknown error";
}

export default function HistoryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [distinctStatusCodes, setDistinctStatusCodes] = useState([]);
    const [distinctWebsites, setDistinctWebsites] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const { data: session, status: sessionStatus } = useSession();
    const [isAdmin, setIsAdmin] = useState(false);

    // Enhanced admin detection with better session handling
    useEffect(() => {
        if (sessionStatus === "authenticated" && session?.user) {
            const role = session.user.role?.toLowerCase();
            const isAdminUser = role === "admin";
            setIsAdmin(isAdminUser);
            console.log("Admin status updated:", { role, isAdminUser, sessionUser: session.user });
        } else {
            setIsAdmin(false);
        }
    }, [session, sessionStatus]);

    // Get filters from URL search params
    const filters = useMemo(() => ({
        date: searchParams.get("date") || "",
        action: searchParams.get("action") || "All",
        statusCode: searchParams.get("statusCode") || "All",
        website: searchParams.get("website") || "",
        userId: searchParams.get("userId") || "All"
    }), [searchParams]);

    // Get pagination from URL search params
    const paginationState = useMemo(() => {
        const limitParam = searchParams.get("limit");
        return {
            currentPage: parseInt(searchParams.get("page") || "1", 10),
            limit: limitParam === "All" ? "All" : parseInt(limitParam || "25", 10)
        };
    }, [searchParams]);

    const [paginationData, setPaginationData] = useState({
        totalPages: 1,
        totalCount: 0
    });

    const updateQueryParams = useCallback((updates) => {
        const newParams = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value === "" || value === "All" || (key === "page" && value === 1)) {
                newParams.delete(key);
            } else {
                newParams.set(key, value.toString());
            }
        });
        router.push(`/dashboard/history?${newParams.toString()}`);
    }, [router, searchParams]);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.date) params.append("date", filters.date);
            if (filters.action !== "All") params.append("action", filters.action);
            if (filters.statusCode !== "All") params.append("statusCode", filters.statusCode);
            if (filters.website) params.append("website", filters.website);
            if (filters.userId !== "All") params.append("userId", filters.userId);

            params.append("limit", paginationState.limit.toString());
            params.append("page", paginationState.currentPage.toString());

            const res = await fetch(`/api/history?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();

                if (data.history) {
                    setHistory(data.history);

                    if (data.pagination) {
                        setPaginationData({
                            totalPages: data.pagination.totalPages,
                            totalCount: data.pagination.totalCount
                        });
                    }
                }

                if (data.distinctStatusCodes) {
                    setDistinctStatusCodes(data.distinctStatusCodes);
                }

                if (data.distinctWebsites) {
                    setDistinctWebsites(data.distinctWebsites);

                    // Auto-selection logic
                    if (!filters.website && data.distinctWebsites.length > 0) {
                        if (data.distinctWebsites.length === 1) {
                            updateQueryParams({ website: data.distinctWebsites[0], page: 1 });
                        }
                    }
                }

            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setLoading(false);
        }
    }, [filters, paginationState, isAdmin, updateQueryParams]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Fetch users for admin filter
    useEffect(() => {
        if (isAdmin && allUsers.length === 0) {
            const fetchFilterUsers = async () => {
                try {
                    const res = await fetch("/api/admin/users");
                    if (res.ok) {
                        const data = await res.json();
                        setAllUsers(data);
                    }
                } catch (err) {
                    console.error("Failed to fetch filter users", err);
                }
            };
            fetchFilterUsers();
        }
    }, [isAdmin, allUsers.length]);

    const handlePageChange = (newPage) => {
        updateQueryParams({ page: newPage });
    };

    const handleFilterChange = (key, value) => {
        updateQueryParams({ [key]: value, page: 1 });
    };

    const handleLimitChange = (value) => {
        updateQueryParams({ limit: value, page: 1 });
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Submission History</h1>
                <p className="text-muted-foreground">Track all URLs submitted to the indexing API.</p>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="space-y-1 pb-4">
                        <CardTitle className="text-lg">Recent Submissions</CardTitle>
                        <CardDescription>
                            Filtering {history.length} records
                            {/* Debug indicator - can be removed after testing */}
                            {sessionStatus === "authenticated" && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                                    Role: {session?.user?.role || 'none'} | Admin: {isAdmin ? 'Yes' : 'No'}
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Admin User Filter */}
                            {isAdmin && (
                                <Select
                                    value={filters.userId}
                                    onValueChange={(val) => handleFilterChange("userId", val)}
                                >
                                    <SelectTrigger className="w-[220px]">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-zinc-400" />
                                            <SelectValue placeholder="Select User" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Users</SelectItem>
                                        {allUsers.map((u) => (
                                            <SelectItem key={u._id} value={u._id}>
                                                {u.firstName || u.email.split('@')[0]} ({u.role})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}



                            {/* Website Filter (Dynamic Origins) */}
                            <Select
                                value={filters.website}
                                onValueChange={(val) => handleFilterChange("website", val)}
                            >
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select website" />
                                </SelectTrigger>
                                <SelectContent>
                                    {distinctWebsites.map((site) => (
                                        <SelectItem key={site} value={site}>
                                            {site}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Action Filter */}
                            <Select
                                value={filters.action}
                                onValueChange={(value) => handleFilterChange("action", value)}
                            >
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue placeholder="All Actions" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Actions</SelectItem>
                                    <SelectItem value="Publish">Publish</SelectItem>
                                    <SelectItem value="Remove">Remove</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Status Code Filter */}
                            <Select
                                value={filters.statusCode}
                                onValueChange={(value) => handleFilterChange("statusCode", value)}
                            >
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Status</SelectItem>
                                    {distinctStatusCodes.map((code) => (
                                        <SelectItem key={code} value={code.toString()}>
                                            {code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Date Picker */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[200px] justify-start text-left font-normal",
                                            !filters.date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {filters.date ? format(new Date(filters.date), "MMM d, yyyy") : <span>Filter by date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={filters.date ? new Date(filters.date + "T00:00:00") : undefined}
                                        onSelect={(date) => {
                                            if (date) {
                                                handleFilterChange("date", format(date, "yyyy-MM-dd"));
                                            } else {
                                                handleFilterChange("date", "");
                                            }
                                        }}
                                        disabled={(date) => date > new Date()}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>

                            {/* Rows Per Page */}
                            <Select
                                value={paginationState.limit.toString()}
                                onValueChange={handleLimitChange}
                            >
                                <SelectTrigger className="w-[110px]">
                                    <SelectValue placeholder={`${paginationState.limit} rows`} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 rows</SelectItem>
                                    <SelectItem value="25">25 rows</SelectItem>
                                    <SelectItem value="50">50 rows</SelectItem>
                                    <SelectItem value="100">100 rows</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead className="min-w-[300px]">URL</TableHead>
                                    <TableHead className="w-[100px]">Action</TableHead>
                                    <TableHead className="w-[80px]">Status Code</TableHead>
                                    <TableHead className="max-w-[200px]">Response</TableHead>
                                    <TableHead className="text-right w-[120px]">Timestamp</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : history.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            {loading ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : "No submission history records found matching this filter."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.map((item) => (
                                        <TableRow key={item._id}>
                                            <TableCell className="text-sm font-medium whitespace-nowrap">
                                                {item.submittedAt ? format(new Date(item.submittedAt), "MMM d, yyyy") : format(new Date(item.createdAt), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell className="max-w-[350px] min-w-[200px]">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 tracking-wider truncate">
                                                        {item.website} {isAdmin && item.userId && (
                                                            <span className="text-zinc-500 font-medium ml-1">
                                                                • {allUsers.find(u => u._id === item.userId)?.firstName || allUsers.find(u => u._id === item.userId)?.email || 'Staff'}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span
                                                        className="font-mono text-xs text-foreground/90 truncate leading-tight mt-0.5"
                                                        title={item.url}
                                                    >
                                                        {item.url}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`font-medium text-xs ${item.action === "Publish"
                                                    ? "text-blue-600 dark:text-blue-400"
                                                    : "text-amber-600 dark:text-amber-400"
                                                    }`}>
                                                    {item.action}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${item.statusCode >= 200 && item.statusCode < 300
                                                    ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                                    : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                                    }`}>
                                                    {item.statusCode}
                                                </span>
                                            </TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <div
                                                    className={cn("truncate text-xs",
                                                        item.status === "success" ? "text-green-600 font-medium" : "text-red-600 font-normal"
                                                    )}
                                                    title={getResponseText(item.statusCode, item.rawResponse)}
                                                >
                                                    {getResponseText(item.statusCode, item.rawResponse)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap text-[11px] text-muted-foreground">
                                                {item.submittedAt ? format(new Date(item.submittedAt), "h:mm aa").toLowerCase() : format(new Date(item.createdAt), "h:mm aa").toLowerCase()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {paginationData.totalPages > 1 && (
                        <div className="mt-4">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (paginationState.currentPage > 1) handlePageChange(paginationState.currentPage - 1); }}
                                            className={paginationState.currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>

                                    {/* Simple previous page logic if needed, or just show current */}
                                    {paginationState.currentPage > 1 && (
                                        <PaginationItem>
                                            <PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(paginationState.currentPage - 1); }}>
                                                {paginationState.currentPage - 1}
                                            </PaginationLink>
                                        </PaginationItem>
                                    )}

                                    <PaginationItem>
                                        <PaginationLink href="#" isActive>
                                            {paginationState.currentPage}
                                        </PaginationLink>
                                    </PaginationItem>

                                    {paginationState.currentPage < paginationData.totalPages && (
                                        <PaginationItem>
                                            <PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(paginationState.currentPage + 1); }}>
                                                {paginationState.currentPage + 1}
                                            </PaginationLink>
                                        </PaginationItem>
                                    )}

                                    {/* Ellipsis if needed for large pages, but keeping simple for now as per shadcn basic usage */}

                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (paginationState.currentPage < paginationData.totalPages) handlePageChange(paginationState.currentPage + 1); }}
                                            className={paginationState.currentPage === paginationData.totalPages ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
