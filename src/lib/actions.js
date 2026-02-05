
"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function authenticate(prevState, formData) {
    try {
        const data = Object.fromEntries(formData);
        await signIn("credentials", {
            ...data,
            redirectTo: "/dashboard"
        });
    } catch (error) {
        if (error instanceof AuthError) {
            console.log("AuthError type:", error.type);
            console.log("AuthError message:", error.message);

            // Check for re-thrown errors from authorize
            const cause = error.cause?.err || error.cause || error;
            const msg = cause.message || "";

            if (msg.includes("IncorrectPassword")) {
                return "Incorrect password.";
            }

            switch (error.type) {
                case "CredentialsSignin":
                    return "Invalid credentials.";
                default:
                    return "An error occurred during sign in.";
            }
        }

        // NextAuth v5 uses redirects which throw errors. We must re-throw them.
        if (error.message === "NEXT_REDIRECT" || error.digest?.startsWith("NEXT_REDIRECT")) {
            throw error;
        }

        console.error("UNEXPECTED AUTH ERROR:", error);
        throw error;
    }
}
