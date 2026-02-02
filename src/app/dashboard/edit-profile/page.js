
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    User,
    Mail,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function EditProfilePage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    // Prefill username from session
    useEffect(() => {
        if (session?.user?.firstName && !firstName) {
            setFirstName(session.user.firstName);
        }
    }, [session, firstName]);


    const handleUpdate = async (e) => {
        e.preventDefault();

        if (password && password !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match" });
            return;
        }

        setLoading(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName, password: password || undefined }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: "success", text: "Profile updated successfully!" });
                setPassword("");
                setConfirmPassword("");

                // Update local session state
                try {
                    await update({
                        ...session,
                        user: {
                            ...session?.user,
                            firstName
                        }
                    });
                } catch (updateErr) {
                    console.error("Session update error:", updateErr);
                    // Silently fail or log, don't show general error if backend update succeeded
                }
            } else {
                setMessage({ type: "error", text: data.error || "Failed to update profile" });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Something went wrong. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="h-9 w-9 border border-zinc-200"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Edit Profile</h1>
                    <p className="text-sm text-zinc-500">Update your account information and password.</p>
                </div>
            </div>

            {message.text && (
                <Alert variant={message.type === "success" ? "default" : "destructive"} className={message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : ""}>
                    {message.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4" />}
                    <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            )}

            <Card className="border-zinc-200 shadow-md bg-white py-0">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-6 flex flex-col rounded-t-xl">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <User className="h-5 w-5 text-emerald-600" />
                        Account Details
                    </CardTitle>
                    <CardDescription>Changes will be saved and reflected across the dashboard immediately.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Basic Info */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-zinc-900 border-l-2 border-emerald-500 pl-3">General Information</h3>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <Input
                                        disabled
                                        value={session?.user?.email || ""}
                                        className="pl-10 bg-zinc-50 border-zinc-200 text-zinc-500 font-medium cursor-not-allowed"
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-400 font-medium italic pl-1">Email is managed by administrator and cannot be changed.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">User Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <Input
                                        placeholder="Enter username"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="pl-10 border-zinc-200 focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Security */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-zinc-900 border-l-2 border-emerald-500 pl-3">Security & Password</h3>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <Input
                                        type={showNewPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-10 border-zinc-200 focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                                    >
                                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-zinc-400 font-medium italic pl-1">Leave blank if you don't want to change your password.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-700">Confirm New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <Input
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-10 pr-10 border-zinc-200 focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                        </div>

                        <div className="md:col-span-2 pt-6 border-t border-zinc-100 flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.back()}
                                className="font-bold border-zinc-200"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-100 border-emerald-600 transition-all active:scale-95"
                            >
                                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
