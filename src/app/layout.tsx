import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { themeBootScript } from "@/theme/tokens";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const sora = Sora({ variable: "--font-sora", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "AURALIS", template: "%s · AURALIS" },
  description: "AURALIS is an open-source, community-driven music platform. Upload, stream, mix and share.",
  applicationName: "AURALIS",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#080B10",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return (
    <html
      lang={locale}
      data-theme="dark"
      className={`${inter.variable} ${sora.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
