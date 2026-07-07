import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://assessment.skilio.co";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Skilio Assessment - Job Portal",
    template: "%s | Skilio Assessment",
  },
  description:
    "Skilio Assessment helps employers publish jobs, manage applicants, and connect candidate applications with Skilio portfolio profiles.",
  keywords: [
    "job portal",
    "candidate applications",
    "employer hiring",
    "Skilio portfolio",
    "candidate assessment",
    "applicant management",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Skilio Assessment",
    title: "Skilio Assessment - Job Portal",
    description:
      "Publish jobs, manage applicants, and connect hiring workflows with Skilio portfolio profiles.",
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/images/marketing/hero-screenshots.webp`,
        width: 1920,
        height: 960,
        alt: "Skilio Assessment Job Portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skilio Assessment - Job Portal",
    description:
      "Publish jobs, manage applicants, and connect hiring workflows with Skilio portfolio profiles.",
    images: [`${siteUrl}/images/marketing/hero-screenshots.webp`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
