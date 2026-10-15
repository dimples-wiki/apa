import { Clapperboard, FolderKanban, Mountain, Settings, Shirt, Users } from "lucide-react";
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
    { title: "项目", to: "/projects", icon: FolderKanban, count: projects.data?.length },
    { title: "演员", to: "/actors", icon: Users, count: actors.data?.length },
    { title: "场景", to: "/scenes", icon: Mountain, count: scenes.data?.length },
    { title: "服饰", to: "/costumes", icon: Shirt, count: costumes.data?.length },
  ];
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <SidebarMenuItem className="relative">
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className="relative data-[active=true]:bg-foreground/18 data-[active=true]:text-foreground data-[active=true]:before:absolute data-[active=true]:before:top-1/2 data-[active=true]:before:left-0 data-[active=true]:before:h-5 data-[active=true]:before:w-1 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full data-[active=true]:before:bg-foreground data-[active=true]:before:content-['']"
      >
        <NavLink to={item.to}>
          <item.icon />
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
      {item.count !== undefined ? (
        <>
          <SidebarMenuBadge className="tabular-nums">{item.count}</SidebarMenuBadge>
          <span className="pointer-events-none absolute top-1/2 right-2 hidden size-1 -translate-y-1/2 rounded-full bg-foreground/45 group-data-[collapsible=icon]:block" />
        </>
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
        <div className="flex h-12 items-center justify-between gap-1 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <SidebarMenuButton
            size="lg"
            className="pointer-events-none group-data-[collapsible=icon]:hidden"
            tooltip="APA"
          >
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
              <Clapperboard className="size-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">APA</span>
          </SidebarMenuButton>
          <SidebarTrigger className="size-7 shrink-0 text-sidebar-foreground/60" />
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
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="系统设置"
              className="relative data-[active=true]:bg-foreground/18 data-[active=true]:text-foreground data-[active=true]:before:absolute data-[active=true]:before:top-1/2 data-[active=true]:before:left-0 data-[active=true]:before:h-5 data-[active=true]:before:w-1 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full data-[active=true]:before:bg-foreground data-[active=true]:before:content-['']"
            >
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
