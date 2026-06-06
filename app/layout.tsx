import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";

import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "BC.Game Casino",
    template: "%s | BC.Game Casino",
  },
  description: "Premium crypto casino experience with your favorite games. Play slots, table games, and live dealer games in a secure environment.",
  keywords: ["casino", "crypto casino", "bc.game", "slots", "poker", "blackjack", "live casino", "bitcoin casino"],
  authors: [{ name: "BC.Game Casino" }],
  creator: "BC.Game Casino",
  publisher: "BC.Game Casino",
  robots: "index, follow",
  applicationName: "BC.Game Casino",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BC.Game Casino",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bcgame.casino",
    title: "BC.Game Casino - Premium Crypto Gaming Experience",
    description: "Experience premium crypto casino gaming with exclusive bonuses and VIP rewards.",
    siteName: "BC.Game Casino",
  },
  twitter: {
    card: "summary_large_image",
    title: "BC.Game Casino - Premium Crypto Gaming Experience",
    description: "Experience premium crypto casino gaming with exclusive bonuses and VIP rewards.",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#00C851" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        inter.variable,
        geistSans.variable,
        geistMono.variable,
        "font-sans"
      )}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            {children}

            <Toaster
              position="top-right"
              richColors
              closeButton
            />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}