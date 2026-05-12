import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListConversations, useListMessages, useSendMessage, useUpdateConversation,
  getListConversationsQueryKey, getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, StickyNote, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400",
  closed: "bg-gray-500/15 text-gray-400",
  follow_up: "bg-amber-500/15 text-amber-400",
  ai_failed: "bg-red-500/15 text-red-400",
  unreplied: "bg-orange-500/15 text-orange-400",
};

const TABS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Follow-up", value: "follow_up" },
  { label: "Closed", value: "closed" },
];

export default function InboxPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isNote, setIsNote] = useState(false);

  const filters = activeTab ? { status: activeTab } : {};
  const { data: conversations, isLoading } = useListConversations(filters, { query: { queryKey: getListConversationsQueryKey(filters) } });
  const { data: messages, isLoading: msgsLoading } = useListMessages(selectedId!, {
    query: { enabled: !!selectedId, queryKey: getListMessagesQueryKey(selectedId!) }
  });
  const sendMsg = useSendMessage();
  const updateConv = useUpdateConversation();

  const filtered = conversations?.filter((c: any) =>
    !search || c.participantName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const selected = conversations?.find((c: any) => c.id === selectedId);

  const handleSend = async () => {
    if (!selectedId || !message.trim()) return;
    try {
      await sendMsg.mutateAsync({ conversationId: selectedId, data: { content: message, isInternalNote: isNote } });
      setMessage("");
      qc.invalidateQueries({ queryKey: getListMessagesQueryKey(selectedId) });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey(filters) });
    } catch {
      toast({ title: "Failed to send", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateConv.mutateAsync({ id, data: { status } });
    qc.invalidateQueries({ queryKey: getListConversationsQueryKey(filters) });
  };

  return (
    <AppLayout>
      <div className="flex h-screen">
        <div className="w-80 flex flex-col border-r border-border">
          <div className="p-4 border-b border-border space-y-3">
            <h1 className="text-base font-bold text-foreground">Inbox</h1>
            <Input
              data-testid="input-search-inbox"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full h-7 text-xs">
                {TABS.map(t => (
                  <TabsTrigger key={t.value} value={t.value} className="flex-1 text-xs">{t.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-3 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No conversations</div>
            ) : (
              filtered.map((conv: any) => (
                <button
                  key={conv.id}
                  data-testid={`row-conversation-${conv.id}`}
                  onClick={() => setSelectedId(conv.id)}
                  className={cn(
                    "w-full flex gap-3 p-3.5 text-left border-b border-border hover:bg-muted/30 transition-colors",
                    selectedId === conv.id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-primary/10 text-primary">
                    {conv.participantName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold text-foreground truncate">{conv.participantName}</p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium shrink-0">{conv.unreadCount}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage ?? "No messages"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[conv.status] ?? STATUS_COLORS.open}`}>
                        {conv.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected?.participantName}</p>
                  <p className="text-xs text-muted-foreground">{selected?.pageName ?? "Unknown page"}</p>
                </div>
                <div className="flex gap-2">
                  {["open", "follow_up", "closed"].map(s => (
                    <Button
                      key={s}
                      data-testid={`button-status-${s}`}
                      variant={selected?.status === s ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleStatusChange(selectedId, s)}
                    >
                      {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1 p-5">
                {msgsLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-3/4" />)}</div>
                ) : !messages?.length ? (
                  <div className="text-center text-xs text-muted-foreground py-10">No messages yet</div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        data-testid={`message-${msg.id}`}
                        className={cn("flex", msg.senderType === "page" ? "justify-end" : "justify-start")}
                      >
                        <div className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                          msg.isInternalNote
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 rounded-sm"
                            : msg.senderType === "page"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                        )}>
                          {msg.isInternalNote && <p className="text-xs font-semibold mb-1 opacity-60">Internal Note</p>}
                          <p>{msg.content}</p>
                          <p className="text-xs opacity-50 mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="px-5 py-4 border-t border-border space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    data-testid="button-toggle-note"
                    onClick={() => setIsNote(!isNote)}
                    className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors", isNote ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:bg-muted")}
                  >
                    <StickyNote size={12} />
                    {isNote ? "Note mode" : "Reply mode"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    data-testid="input-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={isNote ? "Add an internal note..." : "Type a reply..."}
                    className={cn("flex-1", isNote && "border-amber-500/30")}
                  />
                  <Button
                    data-testid="button-send"
                    onClick={handleSend}
                    disabled={!message.trim() || sendMsg.isPending}
                    size="sm"
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
