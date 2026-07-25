import type { Metadata } from "next";
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
  title: "GradeChange AI — Predictive Quality Control",
  description:
    "Real-time predictive quality monitoring and setpoint guidance for paper machine grade transitions. Integrates with Honeywell QCS & DCS Historian.",
  keywords: [
    "GradeChange AI",
    "Paper Machine",
    "Quality Control",
    "Predictive Maintenance",
    "Basis Weight",
    "SHAP Explainability",
    "Industrial AI",
  ],
  authors: [{ name: "GradeChange AI Team" }],
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
