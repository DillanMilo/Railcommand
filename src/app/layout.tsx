import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import ThemeProvider from "@/components/providers/ThemeProvider";
import ServiceWorkerProvider from "@/components/providers/ServiceWorkerProvider";
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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RailCommand",
  },
  openGraph: {
    title: "RailCommand",
    description:
      "Construction & Rail Project Management -- track submittals, RFIs, daily logs, punch lists, and schedules in one place.",
    siteName: "RailCommand",
    type: "website",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F172A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('rc-theme-mode');if(m==='dark'||(m==='auto'&&(new Date().getHours()>=19||new Date().getHours()<6))){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${dmSans.variable} ${jetBrainsMono.variable} ${dmSans.className} antialiased`}
      >
        <ThemeProvider>
          <ServiceWorkerProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ServiceWorkerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
