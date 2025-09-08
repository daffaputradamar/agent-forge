import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Bot, 
  LayoutDashboard, 
  Book, 
  MessageSquare, 
  Share, 
  BarChart3,
  Settings 
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/agents", label: "My Agents", icon: Bot },
  { path: "/knowledge", label: "Knowledge Base", icon: Book },
  { path: "/conversations", label: "Conversations", icon: MessageSquare },
  { path: "/deploy", label: "Deploy", icon: Share },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside className={cn(
      "sidebar fixed md:static inset-y-0 left-0 w-64 bg-card border-r border-border z-50 transition-transform duration-300",
      isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      <div className="flex flex-col h-full">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Bot className="text-primary-foreground w-4 h-4" />
            </div>
            <h1 className="text-xl font-semibold">Agent Builder</h1>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                href={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                  isActive 
                    ? "bg-accent text-accent-foreground" 
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={onClose}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-medium">JD</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">john@company.com</p>
            </div>
            <button 
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-user-settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
