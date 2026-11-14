import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { FlashToast } from "@/components/flash-toast";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ContextLayer", template: "%s · ContextLayer" },
  description: "Evidence-backed tickets from a plain-language request, grounded in your code.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The proxy puts a fresh nonce on every request; next-themes' inline script needs it to pass the CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // next-themes sets the theme class on <html> before hydration, so React must not compare that attribute.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
          {children}
          <Toaster />
          <Suspense>
            <FlashToast />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
