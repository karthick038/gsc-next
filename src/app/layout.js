import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";
import { Providers } from "@/components/session-provider";
import { getSettings } from "@/lib/settings";

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata() {
  try {
    const settings = await getSettings();

    return {
      title: settings.siteTitle || "GSC Dashboard",
      description: "Advanced Google Search Console indexing and monitoring dashboard",
      icons: {
        icon: settings.faviconUrl || "/favicon.ico",
      }
    };
  } catch (e) {
    return {
      title: "GSC Dashboard",
      icons: {
        icon: "/favicon.ico",
      }
    };
  }
}

export default async function RootLayout({ children }) {
  try {
    await clientPromise;
    console.log("✅ [App] MongoDB Connection Status: PASS");
  } catch (e) {
    console.error("❌ [App] MongoDB Connection Status: FAIL", e);
  }

  const session = await auth();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
