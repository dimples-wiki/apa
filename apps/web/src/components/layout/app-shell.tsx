import { Clapperboard, FolderKanban, Mountain, Settings, Shirt, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/projects", label: "项目", icon: FolderKanban },
  { to: "/actors", label: "演员", icon: Users },
  { to: "/scenes", label: "场景", icon: Mountain },
  { to: "/costumes", label: "服饰", icon: Shirt },
  { to: "/settings", label: "设置", icon: Settings },
];

function MobileTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`absolute top-0 h-0.5 w-8 rounded-full bg-foreground transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <tab.icon className="size-5" />
              <span className={isActive ? "font-medium" : undefined}>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4 md:hidden">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-foreground text-background">
              <Clapperboard className="size-3.5" />
            </div>
            <span className="text-[14px] font-semibold tracking-tight">APA</span>
          </div>
        </header>
        <div className="pb-14 md:pb-0">
          <Outlet />
        </div>
        <MobileTabBar />
      </SidebarInset>
    </SidebarProvider>
  );
}
