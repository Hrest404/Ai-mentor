import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Onest: есть кириллица и латиница, одна гарнитура для интерфейса и контента.
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// Канонический адрес сайта (для Open Graph). До выбора домена остаётся локальным.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Репетитор: AI-ментор по английскому",
    template: "%s · Репетитор",
  },
  description:
    "Персональный AI-ментор по английскому: уроки, разбор ошибок, разговорник и подготовка к IELTS.",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Репетитор",
    images: [{ url: "/share.png", width: 1200, height: 630, alt: "Репетитор: AI-ментор по английскому" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={onest.variable}>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
