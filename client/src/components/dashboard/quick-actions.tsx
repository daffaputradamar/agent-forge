import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Code } from "lucide-react";
import { useState } from "react";
import AgentCreationModal from "@/components/agents/agent-creation-modal";
import { useLocation } from "wouter";

export default function QuickActions() {
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [location, navigate] = useLocation();

  const actions = [
    {
      title: "Create New Agent",
      icon: Plus,
      onClick: () => setShowAgentModal(true),
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Upload Knowledge",
      icon: Upload,
      onClick: () => {
        navigate("/knowledge");
      },
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    }
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.title}
                variant="ghost"
                className="w-full justify-start h-auto p-3"
                onClick={action.onClick}
                data-testid={`button-${action.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className={`w-8 h-8 ${action.bgColor} rounded-lg flex items-center justify-center mr-3`}>
                  <Icon className={`${action.color} w-4 h-4`} />
                </div>
                <span className="font-medium">{action.title}</span>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <AgentCreationModal 
        open={showAgentModal} 
        onOpenChange={setShowAgentModal} 
      />
    </>
  );
}
