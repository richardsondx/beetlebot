import { Sidebar } from "@/components/app-shell/sidebar";
import { MobileTabbar } from "@/components/app-shell/mobile-tabbar";

const showDebug = process.env.BEETLEBOT_DEBUG !== "false";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#1C1B19]">
      <Sidebar showDebug={showDebug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        <MobileTabbar showDebug={showDebug} />
      </div>
    </div>
  );
}
