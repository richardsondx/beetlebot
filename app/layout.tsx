import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "beetlebot — your free time deserves an autopilot",
  description:
    "Open-source AI agent that proactively plans your life — date nights, weekend adventures, rainy day rescues — with your calendar, budget, and consent.",
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
