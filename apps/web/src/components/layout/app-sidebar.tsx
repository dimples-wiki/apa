import { Clapperboard, FolderKanban, Settings, Shirt, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  count: number | undefined;
}

function useNavItems(): NavItem[] {
  const projects = useApi(api.projects);
  const actors = useApi(api.actors);
  const scenes = useApi(api.scenes);
  const costumes = useApi(api.costumes);

  return [
    { title: "项目列表", to: "/projects", icon: FolderKanban, count: projects.data?.length },
    { title: "演员", to: "/actors", icon: Users, count: actors.data?.length },
    { title: "场景", to: "/scenes", icon: Clapperboard, count: scenes.data?.length },
    { title: "服饰", to: "/costumes", icon: Shirt, count: costumes.data?.length },
  ];
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
        <NavLink to={item.to}>
          <item.icon />
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
      {item.count !== undefined ? (
        <SidebarMenuBadge className="tabular-nums">{item.count}</SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const items = useNavItems();
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-1 px-2 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-1">
          <SidebarMenuButton
            size="lg"
            className="pointer-events-none group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            tooltip="FilmStudio"
          >
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#6e79d6] to-[#4c55b8] text-white shadow-sm">
              <Clapperboard className="size-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">FilmStudio</span>
          </SidebarMenuButton>
          <SidebarTrigger className="size-7 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:mt-1" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>创作</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <NavRow key={item.to} item={item} active={pathname === item.to} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"} tooltip="系统设置">
              <NavLink to="/settings">
                <Settings />
                <span>系统设置</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
