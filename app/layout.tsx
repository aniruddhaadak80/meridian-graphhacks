import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MERIDIAN — Living Company Brain | Graph Hacks 2026",
  description: "Autonomous agent crew with FalkorDB as memory, reasoning and action layer. One graph for all three tracks.",
  metadataBase: new URL("https://meridian-graphhacks.vercel.app"),
  openGraph: {
    title: "MERIDIAN — Give your agents real context",
    description: "4-agent crew on one FalkorDB graph: incident triage, shared memory, company brain — every answer cites its Cypher path.",
    images: ["/screenshots/console.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "MERIDIAN — Living Company Brain",
    description: "4 agents, 1 FalkorDB graph, all 3 Graph Hacks tracks.",
    images: ["/screenshots/landing.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-void text-white font-display antialiased">{children}</body>
    </html>
  );
}
