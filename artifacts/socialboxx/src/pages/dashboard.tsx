import { AppLayout } from "@/components/layout/app-layout";
import { useGetDashboardStats, useGetRecentConversations, useGetPagePerformance, getGetDashboardStatsQueryKey, getGetRecentConversationsQueryKey, getGetPagePerformanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Users, AlertTriangle, Clock, TrendingUp, CheckCircle } from "lucide-react";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number | undefined; icon: any; color: string }) {
  return (
    <Card data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
          </div>
          <div className="p-2.5 rounded-lg" style={{ background: `${color}18` }}>
            <Icon size={18} style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  closed: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  follow_up: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  ai_failed: "bg-red-500/15 text-red-400 border-red-500/20",
};

export default function DashboardPage() {
  const { data: stats } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const { data: recentConvs } = useGetRecentConversations({ query: { queryKey: getGetRecentConversationsQueryKey() } });
  const { data: pagePerf } = useGetPagePerformance({ query: { queryKey: getGetPagePerformanceQueryKey() } });

  return (
    <AppLayout>
      <div className="p-7 space-y-7">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your social inbox</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Messages Today" value={stats?.totalMessagesToday} icon={MessageSquare} color="#4f6ef7" />
          <StatCard label="Unreplied" value={stats?.unrepliedCount} icon={AlertTriangle} color="#f59e0b" />
          <StatCard label="Leads Pending" value={stats?.leadsPending} icon={Users} color="#10b981" />
          <StatCard label="Follow-ups Due" value={stats?.followUpsDue} icon={Clock} color="#ef4444" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Reply Rate" value={stats?.replyRate} icon={TrendingUp} color="#4f6ef7" />
          <StatCard label="AI Failed" value={stats?.aiFailedCount} icon={AlertTriangle} color="#ef4444" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Recent Conversations</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {!recentConvs ? (
                <div className="px-6 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recentConvs.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No conversations yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentConvs.map((conv) => (
                    <div key={conv.id} data-testid={`row-conversation-${conv.id}`} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}>
                        {conv.participantName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{conv.participantName}</p>
                        <p className="text-xs text-muted-foreground truncate">{conv.lastMessage ?? "No messages yet"}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[conv.status] ?? STATUS_COLORS.open}`}>
                        {conv.status.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Page Performance</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {!pagePerf ? (
                <div className="px-6 space-y-3">
                  {[1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : pagePerf.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No pages connected yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {pagePerf.map((page, i) => (
                    <div key={i} data-testid={`row-page-${i}`} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{page.name}</p>
                        <p className="text-xs text-muted-foreground">{page.messages} msgs · {page.leads} leads</p>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: "hsl(var(--primary))" }}>{page.rate}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
