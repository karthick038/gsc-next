"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOtpAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function VerifyOtpContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const email = searchParams.get("email");
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!email) {
            router.push("/forgot-password");
        }
    }, [email, router]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (otp.length !== 4) {
            setError("Please enter a 4-digit code");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const result = await verifyOtpAction(email, otp);
            if (result.error) {
                setError(result.error);
            } else if (result.success) {
                router.push(`/reset-password?email=${encodeURIComponent(email)}&otp=${otp}`);
            }
        } catch (err) {
            setError("Verification failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card className="mx-auto w-full max-w-[400px]">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Verify OTP</CardTitle>
                <CardDescription className="text-center">
                    Enter the 4-digit code sent to <strong>{email}</strong>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="otp">4-Digit OTP Code</Label>
                        <Input
                            id="otp"
                            type="text"
                            placeholder="0000"
                            maxLength={4}
                            className="text-center text-2xl tracking-[1rem] font-bold"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            required
                            disabled={isLoading}
                        />
                        {error && (
                            <p className="text-sm text-red-500 font-medium text-center">{error}</p>
                        )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? "Verifying..." : "Verify Code"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

export default function VerifyOtpPage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
            <Suspense fallback={<div>Loading...</div>}>
                <VerifyOtpContent />
            </Suspense>
        </main>
    );
}
