import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RailCommand",
    template: "%s | RailCommand",
  },
  description:
    "Construction & Rail Project Management -- track submittals, RFIs, daily logs, punch lists, and schedules in one place.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "RailCommand",
    description:
      "Construction & Rail Project Management -- track submittals, RFIs, daily logs, punch lists, and schedules in one place.",
    siteName: "RailCommand",
    type: "website",
  },
  other: {
    "theme-color": "#0F172A",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${dmSans.variable} ${jetBrainsMono.variable} ${dmSans.className} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
