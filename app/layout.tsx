import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import PWARegister from "@/components/features/PWARegister";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BRAND } from "@/lib/constants/brand";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Usado só no shell do CRM (app/app/[orgSlug]/layout.tsx) — o site
// institucional continua com Inter, é uma marca separada.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.domain),
  title: "Althos CRM",
  description: "CRM multi-tenant da Althos Performance",
  applicationName: "Althos CRM",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo-mark.png", type: "image/png" }],
    apple: [{ url: "/logo-mark.png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Althos",
  },
};

// Theme color reacts to OS light/dark — keeps the address bar in sync
// with the app's actual surface color in installed-PWA mode.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${plexSans.variable}`}>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
          <PWARegister />
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}

