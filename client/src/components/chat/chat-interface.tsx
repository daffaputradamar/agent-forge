import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Minus, Send, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, Message } from "@/types";
import { useCreateConversation, useSendMessage, useMessages } from "@/hooks/use-chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface ChatInterfaceProps {
  agent?: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // if provided, the chat will load this conversation id instead of creating a new one
  initialConversationId?: string | null;
}

function getAgentInitials(name: string) {
  return name
    .split(" ")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

const gradientClasses = [
  "from-blue-500 to-purple-600",
  "from-green-500 to-teal-600", 
  "from-orange-500 to-red-600",
  "from-purple-500 to-pink-600",
  "from-teal-500 to-blue-600",
];

function getGradientClass(agentId: string) {
  const index = agentId.charCodeAt(0) % gradientClasses.length;
  return gradientClasses[index];
}

export default function ChatInterface({ agent, open, onOpenChange, initialConversationId }: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [inputValue, setInputValue] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAssistantTyping, setShowAssistantTyping] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // If no agent is provided, don't render the chat interface. This can
  // happen on pages that list conversations without selecting an agent.
  if (!agent) return null;

  // Simple Markdown -> HTML converter (no external deps).
  // Supports code blocks (```), inline code (`), bold (**text**), italic (*text*), links [text](url), and line breaks.
  function escapeHtml(str: string) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function mdToHtml(input: string) {
    if (!input) return "";

    // Escape first
    let s = escapeHtml(input);

    // Fenced code blocks ```code```
    s = s.replace(/```([\s\S]*?)```/g, (_m, code) => {
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });

    // Inline code `code`
    s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);

    // Links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`);

    // Bold **text**
    s = s.replace(/\*\*(.+?)\*\*/g, (_m, txt) => `<strong>${txt}</strong>`);

    // Italic *text* (avoid matching **)
    s = s.replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, (_m, p, txt) => `${p}<em>${txt}</em>`);

    // Convert remaining single newlines to <br />
    s = s.replace(/\n/g, '<br/>');

    return s;
  }
  
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversationId || "");

  useEffect(() => {
    // sync incoming conversation id prop into local state
    if (initialConversationId) {
      setConversationId(initialConversationId);
    }

    // If there's no agent provided, bail out early (prevents errors when
    // chat component is mounted without an agent, e.g. /conversations page).
    if (!agent?.id) return;

    if (open && !conversationId && !initialConversationId && !createConversation.isPending) {
      // Create a new conversation when chat opens. Guard against repeated
      // calls by checking the mutation pending state. Do not include the
      // mutation object in deps to avoid identity changes retriggering the effect.
      createConversation.create(
        { agentId: agent.id, title: `Chat with ${agent.name}` },
        {
          onSuccess: (conversation: any) => {
            setConversationId(conversation.id);
          }
        }
      );
    }
    // Intentionally omit createConversation from dependencies to avoid
    // effect retriggers when the mutation object identity changes.
  }, [open, conversationId, agent?.id, initialConversationId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async () => {
  if (!inputValue.trim() || !conversationId || sendMessage.isPending) return;

    const content = inputValue.trim();
    setInputValue("");

    setShowAssistantTyping(true);
    sendMessage.mutate(
      { conversationId, content },
      {
        onSuccess: () => setShowAssistantTyping(false),
        onError: () => setShowAssistantTyping(false),
        onSettled: () => setShowAssistantTyping(false)
      }
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Escape key to exit maximize
  useEffect(() => {
    if (!isMaximized) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMaximized(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMaximized]);

  if (!open) return null;

  return (
    <Card
      className={cn(
        "shadow-lg z-50 transition-all duration-200 bg-card border border-border",
        isMaximized
          ? "fixed inset-0 md:left-64 md:inset-y-0 md:right-0 w-auto max-w-none rounded-none flex flex-col" // leave space for sidebar on md+
          : "fixed bottom-4 right-4 w-96",
        !isMaximized && isMinimized && "h-auto"
      )}
      data-testid="chat-interface"
      data-state={isMaximized ? 'maximized' : (isMinimized ? 'minimized' : 'normal')}
    >
      {/* Chat Header */}
      <CardHeader className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 bg-linear-to-br ${getGradientClass(agent.id)} rounded-full flex items-center justify-center`}>
              <span className="text-white text-sm font-medium">
                {getAgentInitials(agent.name)}
              </span>
            </div>
            <div>
              <p className="font-medium text-sm" data-testid="text-chat-agent-name">
                {agent.name}
              </p>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-green-600">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsMaximized(m => !m);
                if (isMinimized) setIsMinimized(false);
              }}
              data-testid="button-maximize-chat"
              aria-label={isMaximized ? 'Restore chat size' : 'Maximize chat'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
              data-testid="button-minimize-chat"
              disabled={isMaximized}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-chat"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
          {/* Chat Messages */}
          <CardContent className={cn("p-0", isMaximized && "flex flex-col flex-1 overflow-hidden")}>  
            <ScrollArea className={cn("p-4 dark:bg-neutral-900", isMaximized ? "h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)]" : "h-96")}> 
              {messagesLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Start a conversation with {agent.name}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={cn(
                        "flex items-start space-x-2",
                        message.role === "user" ? "justify-end" : ""
                      )}
                    >
                      {message.role === "assistant" && (
                        <div className={`w-6 h-6 bg-linear-to-br ${getGradientClass(agent.id)} rounded-full flex items-center justify-center shrink-0`}>
                          <span className="text-white text-xs">
                            {getAgentInitials(agent.name)}
                          </span>
                        </div>
                      )}
                      
                      <div 
                        className={cn(
                          "rounded-lg px-3 py-2 max-w-xs break-words",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted/70 dark:bg-neutral-800 border border-border text-foreground"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <div
                            className="prose text-sm dark:text-white"
                            data-testid={`text-message-${message.id}`}
                            // render converted HTML from markdown
                            dangerouslySetInnerHTML={{ __html: mdToHtml(message.content) }}
                          />
                        ) : (
                          <p className="text-sm" data-testid={`text-message-${message.id}`}>
                            {message.content}
                          </p>
                        )}
                        <p className="text-xs opacity-70 mt-1">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </p>
                      </div>

                      {message.role === "user" && (
                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center shrink-0">
                          <span className="text-muted-foreground text-xs">You</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {showAssistantTyping && (
                    <div className="flex items-start space-x-2">
                      <div className={`w-6 h-6 bg-linear-to-br ${getGradientClass(agent.id)} rounded-full flex items-center justify-center`}>
                        <span className="text-white text-xs">
                          {getAgentInitials(agent.name)}
                        </span>
                      </div>
                      <div className="bg-muted border border-border rounded-lg px-3 py-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>

          {/* Chat Input */}
          <div className={cn("p-4 border-t border-border", isMaximized && "mt-auto")}> 
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sendMessage.isPending || !conversationId}
                data-testid="input-chat-message"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || sendMessage.isPending || !conversationId}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
