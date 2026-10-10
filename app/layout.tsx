import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MERIDIAN — Living Company Brain | Graph Hacks 2026",
  description: "Autonomous agent crew with FalkorDB as memory, reasoning and action layer. One graph for all three tracks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-void text-white font-display antialiased">{children}</body>
    </html>
  );
}
