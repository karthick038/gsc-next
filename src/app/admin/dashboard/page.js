"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Plus, UserPlus, Mail, Shield, User, Search, RefreshCw, Loader2, Eye, EyeOff, Pencil, Trash2, KeyRound, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function UserManagementPage() {
    const { data: session, status } = useSession();
    const currentUserEmail = session?.user?.email;

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ firstName: "", email: "", password: "", role: "user" });
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (res.ok) {
                setUsers(data);
            }
        } catch (err) {
            console.error("Failed to fetch users", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddUser = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        setError("");
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (res.ok) {
                setUsers([data, ...users]);
                setShowForm(false);
                setFormData({ firstName: "", email: "", password: "", role: "user" });
                setShowPassword(false);
            } else {
                setError(data.error || "Failed to add user");
            }
        } catch (err) {
            setError("Something went wrong");
        } finally {
            setIsAdding(false);
        }
    };

    const [editingUser, setEditingUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState({ firstName: "", role: "", password: "" });
    const [isDeleting, setIsDeleting] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null); // stores user object being deleted


    const handleEditUser = async (e) => {
        e.preventDefault();
        setIsEditing(true);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: editingUser._id,
                    firstName: editFormData.firstName,
                    role: editFormData.role,
                    password: editFormData.password || undefined
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setUsers(users.map(u => u._id === editingUser._id ? data : u));
                setEditingUser(null);
            } else {
                alert(data.error || "Failed to edit user");
            }
        } catch (err) {
            alert("Something went wrong");
        } finally {
            setIsEditing(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        const userId = userToDelete._id;
        setIsDeleting(userId);
        try {
            const res = await fetch(`/api/admin/users?userId=${userId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setUsers(users.filter(u => u._id !== userId));
                setUserToDelete(null);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete user");
            }
        } catch (err) {
            alert("Something went wrong");
        } finally {
            setIsDeleting(null);
        }
    };

    const filteredUsers = useMemo(() => {
        // We still need a loading gate for the very first fetch
        if (loading && users.length === 0) return [];

        const searchFiltered = users.filter(user =>
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.firstName || "").toLowerCase().includes(searchQuery.toLowerCase())
        );

        // DETERMINISTIC SORT: API tells us exactly who the current user is.
        // This survives SPA navigation because it's part of the data payload.
        return [...searchFiltered].sort((a, b) => {
            if (a.isCurrentUser) return -1;
            if (b.isCurrentUser) return 1;
            return 0;
        });
    }, [users, searchQuery, loading]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">User Management</h1>
                    <p className="text-sm text-zinc-500 mt-1">Manage all system users and their access levels.</p>
                </div>

                <Dialog open={showForm} onOpenChange={(val) => { setShowForm(val); if (!val) setShowPassword(false); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-100 transition-all active:scale-95 border-red-600">
                            <Plus className="h-4 w-4 mr-2" />
                            Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                                <UserPlus className="h-5 w-5 text-red-600" />
                                Add New User
                            </DialogTitle>
                            <DialogDescription>
                                Create a new user account. They will be assigned the 'user' role by default.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddUser} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">First Name</label>
                                <Input
                                    className="h-10 border-zinc-200 focus:ring-red-500"
                                    placeholder="Enter first name"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">Email Address</label>
                                <Input
                                    className="h-10 border-zinc-200 focus:ring-red-500"
                                    type="email"
                                    placeholder="email@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Role Selection (Pills) */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">Role Selection</label>
                                <div className="flex gap-2 w-[60%]">
                                    <Button
                                        type="button"
                                        variant={formData.role === "user" ? "default" : "outline"}
                                        onClick={() => setFormData({ ...formData, role: "user" })}
                                        className={`flex-1 h-9 font-bold uppercase tracking-widest text-[9px] transition-all gap-2 px-0 ${formData.role === "user"
                                            ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100 border-red-600"
                                            : "border-zinc-200 text-zinc-400 hover:bg-zinc-50"
                                            }`}
                                    >
                                        <CheckCircle2 className={`h-3.5 w-3.5 transition-opacity ${formData.role === "user" ? "opacity-100" : "opacity-20"}`} />
                                        User
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.role === "admin" ? "default" : "outline"}
                                        onClick={() => setFormData({ ...formData, role: "admin" })}
                                        className={`flex-1 h-9 font-bold uppercase tracking-widest text-[9px] transition-all gap-2 px-0 ${formData.role === "admin"
                                            ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100 border-red-600"
                                            : "border-zinc-200 text-zinc-400 hover:bg-zinc-50"
                                            }`}
                                    >
                                        <CheckCircle2 className={`h-3.5 w-3.5 transition-opacity ${formData.role === "admin" ? "opacity-100" : "opacity-20"}`} />
                                        Admin
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">Password</label>
                                <div className="relative">
                                    <Input
                                        className="h-10 border-zinc-200 focus:ring-red-500 pr-10"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            {error && <p className="text-xs font-bold text-red-500 bg-red-50 p-2.5 rounded-md border border-red-100">{error}</p>}

                            <DialogFooter className="pt-4 gap-2">
                                <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="font-medium">Cancel</Button>
                                <Button
                                    type="submit"
                                    disabled={isAdding}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold min-w-[120px] border-red-600"
                                >
                                    {isAdding ? "Creating..." : "Create User"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Dynamic Key Trigger: Re-renders the entire table logic when session settles */}
            <Card className="py-0 border-zinc-200 shadow-sm overflow-hidden" key={session?.user?.id || 'loading'}>
                <div className="overflow-x-auto">
                    <CardHeader className="border-b border-zinc-100 bg-zinc-50/50 flex flex-row items-center justify-between space-y-0 px-6 py-6">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <Input
                                placeholder="Search by name or email..."
                                className="h-9 pl-9 bg-white border-zinc-200 focus:ring-blue-500 text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchUsers}
                            className="text-zinc-500 hover:text-zinc-900"
                            title="Refresh List"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-zinc-50/80 hover:bg-zinc-50/80">
                                    <TableHead className="py-4 px-6 text-[11px] uppercase tracking-widest font-bold text-zinc-500">Name</TableHead>
                                    <TableHead className="py-4 px-6 text-[11px] uppercase tracking-widest font-bold text-zinc-500">User Email</TableHead>
                                    <TableHead className="py-4 px-6 text-[11px] uppercase tracking-widest font-bold text-zinc-500">Current Role</TableHead>
                                    <TableHead className="py-4 px-6 text-[11px] uppercase tracking-widest font-bold text-zinc-500 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(loading || status === "loading") && users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-zinc-200" />
                                                <p className="text-zinc-400 text-sm">Synchronizing user directory...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => {
                                        const isCurrentUser = user.isCurrentUser;

                                        return (
                                            <TableRow
                                                key={user._id}
                                                className={`hover:bg-zinc-50 group border-b border-zinc-100 last:border-0 h-16 transition-colors ${isCurrentUser ? "bg-emerald-50/30 hover:bg-emerald-50/50 border-l-4 border-l-emerald-500" : ""
                                                    }`}
                                            >
                                                <TableCell className="px-6 font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase transition-transform group-hover:scale-110 ${isCurrentUser ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                                                            } border`}>
                                                            {user.firstName ? user.firstName.charAt(0) : <User className="h-3 w-3" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className={`text-zinc-900 font-bold ${isCurrentUser ? "text-emerald-900" : ""}`}>
                                                                {user.firstName || "-"}
                                                            </span>
                                                            {isCurrentUser && (
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <Badge variant="secondary" className="bg-emerald-100/50 text-emerald-700 hover:bg-emerald-100/50 border-emerald-200 h-4 px-1 text-[9px] font-black uppercase tracking-tighter">
                                                                        Current User
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <div className="flex items-center gap-2 text-zinc-600">
                                                        <Mail className={`h-3.5 w-3.5 ${isCurrentUser ? "text-emerald-500" : "text-zinc-400"}`} />
                                                        <span className={`text-sm ${isCurrentUser ? "font-bold text-emerald-800" : ""}`}>{user.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full text-zinc-500 border-zinc-200 bg-zinc-50/50"
                                                    >
                                                        {user.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-6 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            onClick={() => {
                                                                setEditingUser(user);
                                                                setEditFormData({ firstName: user.firstName, role: user.role, password: "" });
                                                            }}
                                                            disabled={false} // All admins can edit any user
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                            onClick={() => setUserToDelete(user)}
                                                            disabled={isCurrentUser || isDeleting === user._id}
                                                        >
                                                            {isDeleting === user._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-2">
                                                <UserPlus className="h-10 w-10 text-zinc-100" />
                                                <p className="text-zinc-500 font-medium"> No users found</p>
                                                <p className="text-zinc-400 text-xs">Try adjusting your search criteria.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </div>
            </Card>

            {/* Edit User Modal */}
            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-red-600" />
                            Edit User
                        </DialogTitle>
                        <DialogDescription>
                            Update information for {editingUser?.email}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditUser} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-zinc-700">User Name</label>
                            <Input
                                value={editFormData.firstName}
                                onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                                placeholder="Enter full name"
                                className="border-zinc-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-zinc-700">Role Selection</label>
                            <div className="flex gap-2 w-[60%]">
                                <Button
                                    type="button"
                                    disabled={editingUser?.email === currentUserEmail}
                                    variant={editFormData.role === "user" ? "default" : "outline"}
                                    onClick={() => setEditFormData({ ...editFormData, role: "user" })}
                                    className={`flex-1 h-9 font-bold uppercase tracking-widest text-[9px] transition-all gap-2 px-0 ${editFormData.role === "user"
                                        ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100 border-red-600"
                                        : "border-zinc-200 text-zinc-400 hover:bg-zinc-50"
                                        } ${editingUser?.email === currentUserEmail && editFormData.role !== "user" ? "opacity-30 cursor-not-allowed" : ""}`}
                                >
                                    <CheckCircle2 className={`h-3.5 w-3.5 transition-opacity ${editFormData.role === "user" ? "opacity-100" : "opacity-20"}`} />
                                    User
                                </Button>
                                <Button
                                    type="button"
                                    disabled={editingUser?.email === currentUserEmail}
                                    variant={editFormData.role === "admin" ? "default" : "outline"}
                                    onClick={() => setEditFormData({ ...editFormData, role: "admin" })}
                                    className={`flex-1 h-9 font-bold uppercase tracking-widest text-[9px] transition-all gap-2 px-0 ${editFormData.role === "admin"
                                        ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100 border-red-600"
                                        : "border-zinc-200 text-zinc-400 hover:bg-zinc-50"
                                        } ${editingUser?.email === currentUserEmail && editFormData.role !== "admin" ? "opacity-30 cursor-not-allowed" : ""}`}
                                >
                                    <CheckCircle2 className={`h-3.5 w-3.5 transition-opacity ${editFormData.role === "admin" ? "opacity-100" : "opacity-20"}`} />
                                    Admin
                                </Button>
                            </div>
                            {editingUser?.email === currentUserEmail && (
                                <p className="text-[10px] text-zinc-400 font-medium italic pl-1">You cannot change your own role.</p>
                            )}
                        </div>
                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-bold text-zinc-700 flex justify-between">
                                New Password
                                <span className="text-[10px] font-normal text-zinc-400 italic">Leave blank to keep current</span>
                            </label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={editFormData.password}
                                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="border-zinc-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setEditingUser(null)} className="font-medium">
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isEditing}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 shadow-md shadow-emerald-100 border-emerald-600 transition-all"
                            >
                                {isEditing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert Dialog */}
            <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                <AlertDialogContent className="border-0 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-600" />
                            Delete User
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-500">
                            Are you sure you want to delete <span className="font-bold text-zinc-900">{userToDelete?.email}</span>? This action cannot be undone and will permanently remove their access.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                        <AlertDialogCancel className="font-medium">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteUser();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold border-red-600"
                        >
                            {isDeleting === userToDelete?._id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirm Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
