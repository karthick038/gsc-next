"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const email = searchParams.get("email");
    const otp = searchParams.get("otp");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (!email || !otp) {
            router.push("/forgot-password");
        }
    }, [email, otp, router]);

    useEffect(() => {
        let timer;
        if (success && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        } else if (success && countdown === 0) {
            router.push("/login");
        }
        return () => clearTimeout(timer);
    }, [success, countdown, router]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);

        try {
            const result = await resetPasswordAction(email, otp, password);
            if (result.error) {
                setError(result.error);
            } else if (result.success) {
                setSuccess(true);
            }
        } catch (err) {
            setError("Failed to reset password. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-4 w-full max-w-[400px]">
            {success && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Password Reset Successful</AlertTitle>
                    <AlertDescription>
                        Your password has been updated. Redirecting to login in <span className="font-bold">{countdown}</span> seconds...
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
                    <CardDescription className="text-center">
                        Enter your new password below for <strong>{email}</strong>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="******"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading || success}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="******"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={isLoading || success}
                            />
                            {error && (
                                <p className="text-sm text-red-500 font-medium">{error}</p>
                            )}
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading || success}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isLoading ? "Updating..." : success ? `Redirecting (${countdown}s)...` : "Reset Password"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
            <Suspense fallback={<div>Loading...</div>}>
                <ResetPasswordContent />
            </Suspense>
        </main>
    );
}
