import { useState } from 'react';
import { useAgents } from '@/hooks/use-agents';
import { useTools } from '@/hooks/use-tools';
import AgentToolsManager from '@/components/agents/agent-tools-manager';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ToolsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const toolsQuery = useTools(selectedAgentId); // triggers only when agent selected

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">Tools</h2>
            <p className="text-muted-foreground">Manage HTTP API tools for your agents</p>
          </div>
          <Button
            onClick={() => {
              if (!selectedAgentId) return;
              window.dispatchEvent(new Event('agent-tools:new'));
            }}
            disabled={!selectedAgentId}
            data-testid="button-new-tool"
          >
            <Plus className="mr-2 w-4 h-4" /> New Tool
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-64 bg-card" data-testid="select-agent-tools-filter">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agentsLoading ? (
                <div className="p-2 text-sm">Loading agents...</div>
              ) : agents?.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="min-w-0 flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
                data-testid="input-search-tools"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tools List / Manager */}
      {!selectedAgentId ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Select an agent to view and manage its tools</p>
          </CardContent>
        </Card>
      ) : agentsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <AgentToolsManager agentId={selectedAgentId} filter={searchQuery} />
        </div>
      )}
    </div>
  );
}
