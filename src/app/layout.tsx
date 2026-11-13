import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { localeBootScript } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AmbuLink Clinic",
    template: "%s · AmbuLink Clinic",
  },
  description:
    "Hospital medical transport coordination: transport requests, fleet visibility, driver administration and mission follow-up.",
  robots: { index: false, follow: false },
  applicationName: "AmbuLink Clinic",
};

export const viewport: Viewport = {
  themeColor: "#003164",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-surface text-ink">
        <script dangerouslySetInnerHTML={{ __html: localeBootScript }} />
        {children}
      </body>
    </html>
  );
}
