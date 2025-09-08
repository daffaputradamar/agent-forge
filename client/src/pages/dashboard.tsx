import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import StatsCards from "@/components/dashboard/stats-cards";
import QuickActions from "@/components/dashboard/quick-actions";
import RecentActivity from "@/components/dashboard/recent-activity";
import { useAgents } from "@/hooks/use-agents";
import AgentCard from "@/components/agents/agent-card";
import { useState } from "react";
import AgentCreationModal from "@/components/agents/agent-creation-modal";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [showAgentModal, setShowAgentModal] = useState(false);
  const { data: agents, isLoading } = useAgents();

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
            <p className="text-muted-foreground">
              Manage your AI agents and monitor their performance
            </p>
          </div>
          <Button onClick={() => setShowAgentModal(true)} data-testid="button-new-agent">
            <Plus className="mr-2 w-4 h-4" />
            New Agent
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents Section */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My Agents</CardTitle>
                <Link href="/agents">
                  <Button variant="ghost" size="sm" data-testid="button-view-all-agents">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : !agents || agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No agents created yet</p>
                  <Button 
                    className="mt-4"
                    onClick={() => setShowAgentModal(true)}
                    data-testid="button-create-first-agent"
                  >
                    Create your first agent
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.slice(0, 3).map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="space-y-6">
          <QuickActions />
          <RecentActivity />
        </div>
      </div>

      <AgentCreationModal 
        open={showAgentModal} 
        onOpenChange={setShowAgentModal} 
      />
    </div>
  );
}
