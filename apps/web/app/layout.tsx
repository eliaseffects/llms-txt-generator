import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "llms-txt-generator",
  description: "Generate llms.txt and agent.json from websites or doc folders"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
