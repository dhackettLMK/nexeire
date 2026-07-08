import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { RouteToastBridge } from "@/components/ui/route-toast-bridge";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Nexeire",
  description: "Run UGC marketing on autopilot.",
};

const isAgentationEnabled =
  process.env.NEXT_PUBLIC_ENABLE_AGENTATION === "true";

type AgentationToolbarComponent = () => React.ReactElement | null;

async function getAgentationToolbar(): Promise<AgentationToolbarComponent | null> {
  if (!isAgentationEnabled) {
    return null;
  }

  const { AgentationToolbar } = await import("@/components/agentation-toolbar");
  return AgentationToolbar;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const AgentationToolbar = await getAgentationToolbar();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        <ToastProvider>
          {children}
          <Suspense fallback={null}>
            <RouteToastBridge />
          </Suspense>
          {AgentationToolbar ? <AgentationToolbar /> : null}
        </ToastProvider>
      </body>
    </html>
  );
}
