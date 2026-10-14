import { Clapperboard } from "lucide-react";
import { Outlet } from "react-router";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

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
            <span className="text-[14px] font-semibold tracking-tight">FilmStudio</span>
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
