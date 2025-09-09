import { useState } from "react";
import type { Agent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, Clock, User, Trash } from "lucide-react";
import { useConversations } from "@/hooks/use-chat";
import { useDeleteConversation } from "@/hooks/use-chat";
import { useAgents } from "@/hooks/use-agents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import ChatInterface from "@/components/chat/chat-interface";

export default function Conversations() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agents, isLoading: agentsLoading } = useAgents();
  // Map the sentinel '__all__' to undefined so the hook fetches all conversations.
  const { data: conversations, isLoading: conversationsLoading } = useConversations(selectedAgentId === "__all__" ? undefined : selectedAgentId);
  const deleteMutation = useDeleteConversation();
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);

  // Inline chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);

  const filteredConversations = conversations?.filter(conv =>
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getAgentName = (agentId: string) => {
    return agents?.find(agent => agent.id === agentId)?.name || "Unknown Agent";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Conversations</h2>
            <p className="text-muted-foreground">
              View and manage agent conversations
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="min-w-0 flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
                data-testid="input-search-conversations"
              />
            </div>
          </div>
          
          <Select 
            value={selectedAgentId} 
            onValueChange={setSelectedAgentId}
          >
            <SelectTrigger className="w-64 bg-card" data-testid="select-agent-filter">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All agents</SelectItem>
              {agentsLoading ? (
                <div className="p-2">Loading agents...</div>
              ) : agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversations List */}
      {conversationsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConversations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            {searchQuery ? (
              <div>
                <p className="text-muted-foreground mb-4">
                  No conversations found matching "{searchQuery}"
                </p>
                <Button 
                  variant="secondary" 
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <div>
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No conversations yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Conversations will appear here when users interact with your agents
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        ) : (
        <div className="space-y-4">
          {filteredConversations.map((conversation) => (
            <Card key={conversation.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => {
              const agent = agents?.find(a => a.id === conversation.agentId);
              if (agent) {
                setChatAgent(agent);
                setChatConversationId(conversation.id);
                setChatOpen(true);
              }
            }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-primary" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium truncate" data-testid={`text-conversation-title-${conversation.id}`}>
                        {conversation.title || `Conversation with ${getAgentName(conversation.agentId)}`}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{getAgentName(conversation.agentId)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge 
                      className={getStatusColor(conversation.status)}
                      data-testid={`badge-conversation-status-${conversation.id}`}
                    >
                      {conversation.status.replace(/\b\w/g, char => char.toUpperCase())}
                    </Badge>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="bg-card border border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingConversationId(conversation.id);
                      }}
                      aria-label="Delete conversation"
                      data-testid={`button-delete-conversation-${conversation.id}`}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inline Chat UI for quick previews */}
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingConversationId} onOpenChange={(open) => { if (!open) setDeletingConversationId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the conversation and cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deletingConversationId) {
                deleteMutation.mutate(deletingConversationId);
              }
              setDeletingConversationId(null);
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ChatInterface
        agent={chatAgent || (agents && agents[0]) as any}
        open={chatOpen}
        onOpenChange={(open) => setChatOpen(open)}
        initialConversationId={chatConversationId}
      />
    </div>
  );
}
