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

export const metadata: Metadata = {
  title: {
    default: "Репетитор: AI-ментор по английскому",
    template: "%s · Репетитор",
  },
  description:
    "Персональный AI-ментор по английскому: уроки, разбор ошибок, разговорник и подготовка к IELTS.",
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
