import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import MobileBottomNav from "@/components/MobileBottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import CookieBanner from "@/components/CookieBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AnalyticsPageViews from "@/components/AnalyticsPageViews";
import ScrollReveal from "@/components/ScrollReveal";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LocaleProvider } from "@/contexts/LocaleContext";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://workitsa.co.za"),
  // NB: do NOT set a canonical here. A layout-level canonical is inherited by
  // every child page, which made all pages declare the homepage as their
  // canonical → Google treated them as duplicates and refused to index them.
  // Each page self-canonicalises (server pages set their own; the client-side
  // homepage self-references its served URL).
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  title: {
    default: "Workit — Find work. Get work done. South Africa.",
    template: "%s · Workit",
  },
  description:
    "Workit connects South Africans who need a job done with skilled, verified workers nearby. Gardening, cleaning, trades, deliveries — post a job, agree on a price, get it done.",
  applicationName: "Workit",
  manifest: "/manifest.webmanifest",
  icons: {
    // Lead with /favicon.ico (Google's crawler probes this path directly) and
    // advertise 48px+ squares — Google ignores favicons below a 48px multiple
    // for search results, which is why the old 32×32 wasn't picked up.
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Workit",
    statusBarStyle: "default",
  },
  keywords: [
    "Workit",
    "South Africa jobs",
    "Gauteng gig work",
    "hire gardener",
    "hire cleaner",
    "find work South Africa",
  ],
  authors: [{ name: "Workit" }],
  openGraph: {
    title: "Workit — Find work. Get work done.",
    description:
      "South Africa's people-first work marketplace. Verified workers, fair prices, real reviews.",
    url: "https://workitsa.co.za",
    siteName: "Workit",
    type: "website",
    locale: "en_ZA",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Workit — Find work. Get work done.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workit — Find work. Get work done.",
    description:
      "South Africa's people-first work marketplace. Verified workers, fair prices, real reviews.",
    images: ["/og.png"],
  },
};

// Structured data so Google understands the brand (enables richer results /
// knowledge-panel eligibility over time).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://workitsa.co.za/#org",
      name: "Workit",
      url: "https://workitsa.co.za",
      logo: "https://workitsa.co.za/icon-512.png",
      description:
        "South Africa's people-first marketplace for everyday work — connecting people who need a job done with verified workers nearby.",
      areaServed: { "@type": "Country", name: "South Africa" },
      founder: { "@type": "Person", name: "Tshepo M" },
      parentOrganization: { "@type": "Organization", name: "Furthersky Solutions" },
    },
    {
      "@type": "WebSite",
      "@id": "https://workitsa.co.za/#website",
      url: "https://workitsa.co.za",
      name: "Workit",
      publisher: { "@id": "https://workitsa.co.za/#org" },
      inLanguage: "en-ZA",
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#d97742",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-ZA"
      className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <NotificationsProvider>
                <ConfirmProvider>
                  {children}
                  <InstallPrompt />
                  <MobileBottomNav />
                  <CookieBanner />
                  <ServiceWorkerRegister />
                  <AnalyticsPageViews />
                  <ScrollReveal />
                </ConfirmProvider>
              </NotificationsProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
