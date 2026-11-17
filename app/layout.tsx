import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.BEETLEBOT_BASE_URL ??
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "beetlebot — your free time deserves an autopilot",
  description:
    "Open-source AI agent that proactively plans your life — date nights, weekend adventures, rainy day rescues — with your calendar, budget, and consent.",
  openGraph: {
    title: "beetlebot — your free time deserves an autopilot",
    description:
      "Open-source AI agent that proactively plans your life — date nights, weekend adventures, rainy day rescues — with your calendar, budget, and consent.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1024,
        height: 1024,
        alt: "Beetlebot logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "beetlebot — your free time deserves an autopilot",
    description:
      "Open-source AI agent that proactively plans your life — date nights, weekend adventures, rainy day rescues — with your calendar, budget, and consent.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
