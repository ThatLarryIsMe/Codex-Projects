import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text File Merger",
  description:
    "Upload .txt files, format them with AI, and combine into a single PDF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
