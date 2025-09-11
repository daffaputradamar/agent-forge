import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, MessageSquare, Trash2, Share2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useCreateConversation, useConversations } from "@/hooks/use-chat";
import { formatDistanceToNow } from "date-fns";
import type { Agent } from "@/types";
import { useState } from "react";
import AgentDeployModal from "./agent-deploy-modal";
import ChatInterface from "@/components/chat/chat-interface";
import { useDeleteAgent } from "@/hooks/use-agents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
}

const gradientClasses = [
  "from-blue-500 to-purple-600",
  "from-green-500 to-teal-600", 
  "from-orange-500 to-red-600",
  "from-purple-500 to-pink-600",
  "from-teal-500 to-blue-600",
];

function getAgentInitials(name: string) {
  return name
    .split(" ")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function getGradientClass(agentId: string) {
  const index = agentId.charCodeAt(0) % gradientClasses.length;
  return gradientClasses[index];
}

export default function AgentCard({ agent, onEdit }: AgentCardProps) {
  const [showChat, setShowChat] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showDeploy, setShowDeploy] = useState(false);
  const deleteAgent = useDeleteAgent();
  const conversationsQuery = useConversations(agent.id);
  const createConversation = useCreateConversation();

  const handleDelete = () => {
    deleteAgent.mutate(agent.id);
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    draft: "bg-yellow-100 text-yellow-800",
    inactive: "bg-gray-100 text-gray-800",
  };

  return (
    <>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 bg-linear-to-br ${getGradientClass(agent.id)} rounded-full flex items-center justify-center`}>
              <span className="text-white font-medium text-sm">
                {getAgentInitials(agent.name)}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate" data-testid={`text-agent-name-${agent.id}`}>
                {agent.name}
              </h4>
              <p className="text-sm text-muted-foreground truncate" data-testid={`text-agent-description-${agent.id}`}>
                {agent.description || "No description"}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge 
                className={`${statusColors[agent.status as keyof typeof statusColors] || statusColors.inactive} capitalize`}
                data-testid={`badge-agent-status-${agent.id}`}
              >
                {agent.status}
              </Badge>
              
              <div className="flex items-center space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onEdit?.(agent)}
                  data-testid={`button-edit-agent-${agent.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-chat-agent-${agent.id}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          // create new conversation and open chat with it
                          createConversation.create(
                            { agentId: agent.id, title: `` },
                            {
                              onSuccess: (c: any) => {
                                setSelectedConversationId(c.id);
                                setShowChat(true);
                              },
                            }
                          );
                        }}
                      >
                        New conversation
                      </Button>

                      <div className="border-t pt-2">
                        <p className="text-xs text-muted-foreground mb-1">Continue conversation</p>
                        {conversationsQuery.isLoading ? (
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : !conversationsQuery.data || conversationsQuery.data.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No previous conversations</p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {conversationsQuery.data.map((c: any) => (
                              <button
                                key={c.id}
                                className="w-full text-left p-2 hover:bg-accent rounded-md"
                                onClick={() => {
                                  setSelectedConversationId(c.id);
                                  setShowChat(true);
                                }}
                              >
                                <div className="flex flex-col items-start justify-between">
                                  <span className="truncate max-w-full">{c.title || 'Conversation'}</span>
                                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      data-testid={`button-delete-agent-${agent.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{agent.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeploy(true)}
                  title="Deploy / Embed"
                  data-testid={`button-deploy-agent-${agent.id}`}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChatInterface 
        agent={agent}
        open={showChat}
        onOpenChange={(o) => {
          setShowChat(o);
          if (!o) setSelectedConversationId(null);
        }}
        initialConversationId={selectedConversationId}
      />
  <AgentDeployModal agent={agent} open={showDeploy} onOpenChange={setShowDeploy} />
    </>
  );
}
