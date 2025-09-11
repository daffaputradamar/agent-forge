"use client";

import { Link, useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bot,
  LayoutDashboard,
  Book,
  MessageSquare,
  Share,
  BarChart3,
  Settings,
  Sun,
  Moon
} from "lucide-react";
import { useTheme } from "../theme-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { SignOutButton, useUser } from "@clerk/clerk-react";
import UserProfile from "@/components/auth/user-profile";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarRail,
  useSidebar
} from "../ui/sidebar";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/agents", label: "My Agents", icon: Bot },
  { path: "/knowledge", label: "Knowledge Base", icon: Book },
  { path: "/conversations", label: "Conversations", icon: MessageSquare }
];

export default function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [location] = useLocation();
  const { setTheme } = useTheme();
  const { user } = useUser();
  const { isMobile, setOpenMobile } = useSidebar();
  const [profileOpen, setProfileOpen] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarUrl = (user as any)?.profileImageUrl || (user as any)?.imageUrl || (user as any)?.image?.url;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-border p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold leading-none tracking-tight group-data-[collapsible=icon]:hidden">Agent Builder</h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map(item => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} onClick={handleNavClick} className="py-5">
                    <Link
                      href={item.path}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g,'-')}`}
                      className={cn("flex items-center gap-2", isActive && "")}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <div className="flex items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary group-data-[collapsible=icon]:hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user?.fullName || 'avatar'} className="h-8 w-8 object-cover" />
            ) : (
              <span className="text-sm font-medium text-primary-foreground">{getInitials(user?.fullName ?? undefined)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>Profile</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setTheme('light')}><Sun className="mr-2 h-4 w-4" />Light</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')}><Moon className="mr-2 h-4 w-4" />Dark</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <SignOutButton>
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </SignOutButton>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <UserProfile open={profileOpen} onOpenChange={setProfileOpen} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
