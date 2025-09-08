import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  onMenuToggle: () => void;
}

export default function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  return (
    <header className="md:hidden bg-card border-b border-border p-4 flex items-center justify-between">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onMenuToggle}
        data-testid="button-mobile-menu"
      >
        <Menu className="w-5 h-5" />
      </Button>
      <h1 className="text-lg font-semibold">Agent Builder</h1>
      <div></div>
    </header>
  );
}
