import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MedSupply360", template: "%s · MedSupply360" },
  description: "Business control tower for medical equipment, devices and consumables distributors.",
  robots: { index: false, follow: false }, // private business data: keep out of search engines
  // The picture WhatsApp, Facebook, LinkedIn and X show when the link is shared. It sits in /public so no sign-in is needed to fetch it.
  metadataBase: new URL("https://medsupply360.netlify.app"),
  openGraph: {
    type: "website",
    siteName: "MedSupply360",
    title: "MedSupply360: Every tender. Every device. Every dinar.",
    description: "One place to see sales, tenders, installed machines, stock and cash.",
    images: [{ url: "/share-image.png", width: 1200, height: 630, alt: "MedSupply360: Every tender. Every device. Every dinar." }],
  },
  twitter: { card: "summary_large_image", images: ["/share-image.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#176e60" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
