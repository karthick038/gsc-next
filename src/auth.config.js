
export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
            const isOnAdmin = nextUrl.pathname.startsWith("/admin");
            const isLoginPage = nextUrl.pathname === "/login";
            const isRoot = nextUrl.pathname === "/";

            if (isRoot) {
                if (isLoggedIn) return true;
                return false; // Redirect to login
            }
            if (isLoginPage) {
                if (isLoggedIn) {
                    const userRole = auth.user.role?.toLowerCase();
                    const dest = (userRole === "admin") ? "/admin/dashboard" : "/dashboard";
                    return Response.redirect(new URL(dest, nextUrl));
                }
                return true;
            }

            if (isOnAdmin) {
                if (isLoggedIn) {
                    const userRole = auth.user.role?.toLowerCase();
                    if (userRole === "admin") return true;
                    return Response.redirect(new URL("/dashboard", nextUrl));
                }
                return false; // Redirect to login
            }

            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect to login
            }

            return true;
        },
        async session({ session, token }) {
            if (token) {
                // Redundant mapping for maximum resilience
                session.user.id = token.id || token.sub;
                session.user._id = token.id || token.sub;
                session.user.role = token.role;
                session.user.firstName = token.firstName;
                session.user.email = token.email;
            }
            return session;
        },
        async jwt({ token, user, trigger, session }) {
            // Initial sign in
            if (user) {
                const userId = user.id || user._id;
                token.id = userId;
                token.sub = userId;
                token.role = user.role;
                token.firstName = user.firstName;
                token.email = user.email;
                token.lastSync = Date.now(); // Cache busting
            }
            // Manual session updates
            if (trigger === "update" && session?.user) {
                token.lastSync = Date.now(); // Force update on every manual sync
                if (session.user.firstName !== undefined) token.firstName = session.user.firstName;
                if (session.user.role !== undefined) token.role = session.user.role;
                if (session.user.email !== undefined) token.email = session.user.email;
                if (session.user.id !== undefined) {
                    token.id = session.user.id;
                    token.sub = session.user.id;
                }
            }
            return token;
        }
    },
    providers: [], // Configured in auth.js
};
