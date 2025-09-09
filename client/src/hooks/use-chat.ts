import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCallback } from "react";
import { toast } from "sonner";

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

  const mutation = useMutation({
    mutationFn: ({ agentId, title }: { agentId: string; title?: string }) =>
      api.createConversation(agentId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Error", {
        description: "Failed to create conversation. Please try again.",
      });
    },
  });

  const create = useCallback(
    (data: { agentId: string; title?: string }, options?: any) => {
      return mutation.mutate(data, options);
    },
    [mutation]
  );

  return {
    ...mutation,
    create,
  };
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => api.sendMessage(conversationId, content),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({
        queryKey: ["conversations", conversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Error", {
        description: "Failed to send message. Please try again."
      });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      api.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Deleted", {
        description: "Conversation deleted",
      });
    },
    onError: () => {
      toast.error("Error", {
        description: "Failed to delete conversation",
      });
    },
  });
}
