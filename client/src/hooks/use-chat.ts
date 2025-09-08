import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useToast } from "./use-toast";

export function useConversations(agentId?: string) {
  return useQuery({
    queryKey: ["conversations", agentId],
    queryFn: () => api.getConversations(agentId),
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ["conversations", conversationId, "messages"],
    queryFn: () => api.getMessages(conversationId),
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ agentId, title }: { agentId: string; title?: string }) =>
      api.createConversation(agentId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create conversation. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      api.sendMessage(conversationId, content),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });
}
