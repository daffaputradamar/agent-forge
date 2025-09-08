import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useAgents } from "@/hooks/use-agents";
import AgentCard from "@/components/agents/agent-card";
import AgentCreationModal from "@/components/agents/agent-creation-modal";
import { Skeleton } from "@/components/ui/skeleton";

export default function Agents() {
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: agents, isLoading } = useAgents();

  const filteredAgents = agents?.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2">My Agents</h2>
            <p className="text-muted-foreground">
              Create and manage your AI agents
            </p>
          </div>
          <Button onClick={() => setShowAgentModal(true)} data-testid="button-new-agent">
            <Plus className="mr-2 w-4 h-4" />
            New Agent
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-agents"
          />
        </div>
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-12">
          {searchQuery ? (
            <div>
              <p className="text-muted-foreground mb-4">
                No agents found matching "{searchQuery}"
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                Clear search
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground mb-4">
                No agents created yet
              </p>
              <Button 
                onClick={() => setShowAgentModal(true)}
                data-testid="button-create-first-agent"
              >
                <Plus className="mr-2 w-4 h-4" />
                Create your first agent
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <AgentCreationModal 
        open={showAgentModal} 
        onOpenChange={setShowAgentModal} 
      />
    </div>
  );
}
