import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetReportsData, getGetReportsDataQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const { data, isLoading } = useGetReportsData({ period }, { query: { queryKey: getGetReportsDataQueryKey({ period }) } });

  return (
    <AppLayout>
      <div className="p-7 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Analytics and performance overview</p>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["7d", "30d"] as const).map((p) => (
              <button
                key={p}
                data-testid={`button-period-${p}`}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium transition-colors",
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {p === "7d" ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Total Messages", value: data?.totalMessages },
            { label: "Leads Created", value: data?.leadsCreated },
          ].map(({ label, value }) => (
            <Card key={label} data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
                {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Messages vs Replies</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data?.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="messages" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Messages" />
                  <Line type="monotone" dataKey="replies" stroke="#10b981" strokeWidth={2} dot={false} name="Replies" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Lead Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.leadFunnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
