import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gradechange.local"),
  title: {
    default: "GradeChange AI — Predictive Paper Quality Control",
    template: "%s · GradeChange AI",
  },
  description:
    "Real-time predictive quality monitoring and optimal setpoint guidance for paper machine grade transitions. Integrates with Honeywell QCS & DCS Historian.",
  applicationName: "GradeChange AI",
  keywords: [
    "GradeChange",
    "Paper Machine",
    "Quality Control",
    "Predictive Maintenance",
    "Basis Weight",
    "SHAP Explainability",
    "Industrial AI",
    "MPC",
  ],
  authors: [{ name: "GradeChange AI Team" }],
  creator: "GradeChange AI Team",
  publisher: "GradeChange AI",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/logo.svg"],
    apple: [{ url: "/logo.svg" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
