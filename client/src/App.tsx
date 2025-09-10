import { Switch, Route } from "wouter";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Agents from "@/pages/agents";
import Knowledge from "@/pages/knowledge";
import Conversations from "@/pages/conversations";
import { useState } from "react";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./components/theme-provider";
import SignInPanel from "./components/auth/sign-in";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>
        <div className="flex-1 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agents" component={Agents} />
      <Route path="/knowledge" component={Knowledge} />
      <Route path="/conversations" component={Conversations} />
      <Route component={NotFound} />
    </Switch>
  );
}

const clerkPubKey = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY || (window as any).CLERK_PUBLISHABLE_KEY || 'pk_test_aW50ZXJuYWwtaHllbmEtMjIuY2xlcmsuYWNjb3VudHMuZGV2JA';

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster richColors />
            <SignedOut>
              <SignInPanel />
            </SignedOut>
            <SignedIn>
              <AppLayout>
                <Router />
              </AppLayout>
            </SignedIn>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
