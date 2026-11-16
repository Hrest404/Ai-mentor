import { SiteHeader } from "@/components/site/header";

// Публичная часть: лендинг и тарифы. Подвал каждая страница задаёт сама (у него свой призыв).
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a href="#top" className="skip-link">
        К содержанию
      </a>
      <SiteHeader />
      {children}
    </>
  );
}
