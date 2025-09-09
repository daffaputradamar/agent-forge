import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCallback } from "react";
import { toast } from "sonner";
import type { Message } from "@/types";

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
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string; }) => {
      return api.sendMessage(conversationId, content);
    },
    onMutate: async ({ conversationId, content }) => {
      const key = ["conversations", conversationId, "messages"];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Message[]>(key) || [];
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Message[]>(key, [...previous, optimistic]);
      return { previous, optimisticId: optimistic.id, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Message[]>(context.key, context.previous);
      }
      toast.error("Error", { description: "Failed to send message. Please try again." });
    },
    onSuccess: (data, vars, context) => {
      const { conversationId } = vars;
      const key = ["conversations", conversationId, "messages"];
      // data has userMessage & assistantMessage
      const existing = (queryClient.getQueryData<Message[]>(key) || []).filter(m => !m.id.startsWith("temp-"));
      existing.push(data.userMessage, data.assistantMessage);
      queryClient.setQueryData<Message[]>(key, existing);
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onSettled: (_d, _e, vars) => {
      const key = ["conversations", vars.conversationId, "messages"];
      queryClient.invalidateQueries({ queryKey: key });
    }
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

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, id }: { agentId: string; id: string }) =>
      api.deleteKnowledgeDocument(agentId, id),
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      // lightweight error
    }
  });
}
