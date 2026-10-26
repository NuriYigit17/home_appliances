import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Müşteri Hesap Takibi",
  description: "Satış, taksit ve tahsilat takibi",
  applicationName: "Müşteri Hesap Takibi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
