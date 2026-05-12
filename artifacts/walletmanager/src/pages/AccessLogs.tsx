import { useState } from "react";
import { format } from "date-fns";
import { Filter, ChevronDown, ChevronRight, CheckCircle, XCircle, Activity, FileText, BarChart3, User, Clock, Globe, Key, ArrowRight, Pencil, Plus, Trash2, RefreshCw, ArrowLeftRight, DollarSign, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAccessLogs, useAccessLogsSummary, useAccessLogActions, AccessLog } from "@/hooks/useAccessLogs";
import { 
  useUserActivityLogs, 
  useActivityLogActions, 
  useActivityLogEntityTypes,
  useActivityLogUsers,
  UserActivityLog,
  ACTIVITY_ACTION_CONFIG,
  ENTITY_TYPE_CONFIG,
} from "@/hooks/useUserActivityLogs";
import { Json } from "@/integrations/supabase/types";

// Action badge color mapping for access logs
const ACCESS_ACTION_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  LIVE_REQUEST: { label: "Request", variant: "default" },
  OTP_SUCCESS: { label: "OTP ✓", variant: "default" },
  OTP_SUBMIT: { label: "OTP Submit", variant: "secondary" },
  OTP_RESEND: { label: "OTP Resend", variant: "secondary" },
  TFA_REFRESH: { label: "2FA Refresh", variant: "secondary" },
  ACCOUNT_DISPLAYED: { label: "Account Shown", variant: "default" },
  VERIFY_REQUEST: { label: "Verify", variant: "default" },
  VERIFY_SUCCESS: { label: "Verify ✓", variant: "default" },
  verify: { label: "Login", variant: "default" },
  get_code: { label: "Get Code", variant: "secondary" },
  otp_requested: { label: "OTP Sent", variant: "secondary" },
  otp_resent: { label: "OTP Resent", variant: "secondary" },
  otp_verified: { label: "OTP ✓", variant: "default" },
};

// Get action icon based on action type
const getActionIcon = (action: string) => {
  if (action.includes('CREATE')) return <Plus className="h-4 w-4" />;
  if (action.includes('UPDATE')) return <Pencil className="h-4 w-4" />;
  if (action.includes('DELETE')) return <Trash2 className="h-4 w-4" />;
  if (action.includes('TRANSFER')) return <ArrowLeftRight className="h-4 w-4" />;
  if (action.includes('OPENING_BALANCE')) return <RefreshCw className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

// Get entity type icon
const getEntityIcon = (entityType: string) => {
  if (entityType === 'transaction') return <DollarSign className="h-4 w-4" />;
  if (entityType === 'party_transaction') return <ArrowRight className="h-4 w-4" />;
  if (entityType === 'npr_transfer' || entityType === 'nepali_account') return <Wallet className="h-4 w-4" />;
  if (entityType === 'usd_transfer' || entityType === 'usd_account') return <DollarSign className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

interface AccessLogsProps { embedded?: boolean }
export default function AccessLogs({ embedded = false }: AccessLogsProps = {}) {
  const [activeTab, setActiveTab] = useState("activity");
  const [selectedLog, setSelectedLog] = useState<AccessLog | null>(null);
  const [selectedActivityLog, setSelectedActivityLog] = useState<UserActivityLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showActivityFilters, setShowActivityFilters] = useState(false);
  
  // Access log filters
  const [actionFilter, setActionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Activity log filters
  const [activityActionFilter, setActivityActionFilter] = useState<string>("all");
  const [activityEntityFilter, setActivityEntityFilter] = useState<string>("all");
  const [activityDateFrom, setActivityDateFrom] = useState<string>("");
  const [activityDateTo, setActivityDateTo] = useState<string>("");
  const [activityUserFilter, setActivityUserFilter] = useState<string>("");

  const { data: logs, isLoading: logsLoading } = useAccessLogs({
    action: actionFilter || undefined,
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: summary, isLoading: summaryLoading } = useAccessLogsSummary();
  const { data: actionTypes } = useAccessLogActions();

  const { data: activityLogs, isLoading: activityLoading } = useUserActivityLogs({
    action: activityActionFilter !== "all" ? activityActionFilter : undefined,
    entityType: activityEntityFilter !== "all" ? activityEntityFilter : undefined,
    dateFrom: activityDateFrom || undefined,
    dateTo: activityDateTo || undefined,
    userEmail: activityUserFilter || undefined,
  });
  const { data: activityActionTypes } = useActivityLogActions();
  const { data: activityEntityTypes } = useActivityLogEntityTypes();
  const { data: activityUsers } = useActivityLogUsers();

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "yyyy-MM-dd HH:mm:ss");
  };

  const formatShortDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, HH:mm");
  };

  const formatFullDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy 'at' hh:mm:ss a");
  };

  const getAccessActionBadge = (action: string) => {
    const config = ACCESS_ACTION_BADGES[action] || { label: action, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getActivityActionBadge = (action: string) => {
    const config = ACTIVITY_ACTION_CONFIG[action] || { label: action, variant: "outline" as const };
    return (
      <Badge variant={config.variant} className="gap-1">
        {getActionIcon(action)}
        {config.label}
      </Badge>
    );
  };

  const getEntityTypeBadge = (entityType: string) => {
    const config = ENTITY_TYPE_CONFIG[entityType] || { label: entityType };
    return (
      <Badge variant="outline" className="gap-1">
        {getEntityIcon(entityType)}
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string | null) => {
    if (status === "SUCCESS") {
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
    }
    if (status === "FAIL") {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Fail</Badge>;
    }
    return <Badge variant="outline">{status || "-"}</Badge>;
  };

  const clearFilters = () => {
    setActionFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const clearActivityFilters = () => {
    setActivityActionFilter("all");
    setActivityEntityFilter("all");
    setActivityDateFrom("");
    setActivityDateTo("");
    setActivityUserFilter("");
  };

  const renderMetaJson = (data: Json | Record<string, unknown> | null, title: string) => {
    if (!data) return null;
    try {
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
    } catch {
      return null;
    }
  };

  // Format details for display in the table
  const getActivityDetails = (log: UserActivityLog) => {
    const meta = log.meta as Record<string, unknown> | null;
    if (!meta) return null;

    const details: string[] = [];
    
    if (meta.amount_npr) details.push(`NPR ${Number(meta.amount_npr).toLocaleString()}`);
    if (meta.amount) details.push(`${Number(meta.amount).toLocaleString()}`);
    if (meta.total) details.push(`Total: NPR ${Number(meta.total).toLocaleString()}`);
    if (meta.txn_type) details.push(String(meta.txn_type));
    if (meta.entry_type) details.push(String(meta.entry_type));
    if (meta.from_account) details.push(`From: ${meta.from_account}`);
    if (meta.to_account) details.push(`To: ${meta.to_account}`);
    if (meta.from_wallet) details.push(`From: ${meta.from_wallet}`);
    if (meta.to_wallet) details.push(`To: ${meta.to_wallet}`);
    if (meta.name) details.push(`Account: ${meta.name}`);
    if (meta.opening_balance_npr) details.push(`Opening: NPR ${Number(meta.opening_balance_npr).toLocaleString()}`);
    if (meta.opening_balance_amount) details.push(`Opening: ${Number(meta.opening_balance_amount).toLocaleString()}`);
    if (meta.remark) details.push(`"${meta.remark}"`);

    return details.length > 0 ? details.join(' • ') : null;
  };

  const inner = (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Activity Logs"
          description="Track user activities and /live page access events"
        />
      )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity Log
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="detailed" className="gap-2">
              <FileText className="h-4 w-4" />
              Details Log
            </TabsTrigger>
          </TabsList>

          {/* Activity Log Tab - User CRUD operations */}
          <TabsContent value="activity" className="space-y-4">
            {/* Filters */}
            <Collapsible open={showActivityFilters} onOpenChange={setShowActivityFilters}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {showActivityFilters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {(activityActionFilter !== "all" || activityEntityFilter !== "all" || activityDateFrom || activityDateTo || activityUserFilter) && (
                    <Badge variant="secondary" className="ml-1">Active</Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label>User</Label>
                        <Select value={activityUserFilter || "all"} onValueChange={(v) => setActivityUserFilter(v === "all" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="All users" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All users</SelectItem>
                            {activityUsers?.map(user => (
                              <SelectItem key={user} value={user}>
                                {user}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Action</Label>
                        <Select value={activityActionFilter} onValueChange={setActivityActionFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="All actions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All actions</SelectItem>
                            {activityActionTypes?.map(action => (
                              <SelectItem key={action} value={action}>
                                {ACTIVITY_ACTION_CONFIG[action]?.label || action}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Entity Type</Label>
                        <Select value={activityEntityFilter} onValueChange={setActivityEntityFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="All types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            {activityEntityTypes?.map(type => (
                              <SelectItem key={type} value={type}>
                                {ENTITY_TYPE_CONFIG[type]?.label || type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>From Date</Label>
                        <Input
                          type="date"
                          value={activityDateFrom}
                          onChange={(e) => setActivityDateFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>To Date</Label>
                        <Input
                          type="date"
                          value={activityDateTo}
                          onChange={(e) => setActivityDateTo(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button variant="ghost" size="sm" onClick={clearActivityFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>

            {/* Stats */}
            {activityLogs && activityLogs.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {activityLogs.length} log entries</span>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {activityLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : activityLogs && activityLogs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">User</TableHead>
                        <TableHead className="w-[200px]">Action</TableHead>
                        <TableHead className="w-[150px]">Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-[150px]">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs.map((log) => (
                        <TableRow 
                          key={log.id} 
                          className="cursor-pointer hover:bg-muted/50" 
                          onClick={() => setSelectedActivityLog(log)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium text-sm truncate max-w-[120px]" title={log.user_email}>
                                {log.user_email.split('@')[0]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getActivityActionBadge(log.action)}</TableCell>
                          <TableCell>{getEntityTypeBadge(log.entity_type)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate block max-w-[300px]" title={getActivityDetails(log) || '-'}>
                              {getActivityDetails(log) || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatShortDate(log.created_at)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No activity logs found.</p>
                    <p className="text-sm mt-1">Logs will appear when users create, update, or delete data.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab - Party access summary */}
          <TabsContent value="summary" className="space-y-4">
            {summaryLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : summary && summary.length > 0 ? (
              <div className="grid gap-4">
                {summary.map((item) => (
                  <Card key={item.party_name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-primary" />
                          {item.party_name}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{item.total_access} total</Badge>
                          {item.success_count > 0 && (
                            <Badge variant="default" className="bg-green-600">{item.success_count} ✓</Badge>
                          )}
                          {item.fail_count > 0 && (
                            <Badge variant="destructive">{item.fail_count} ✗</Badge>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Last Access
                          </p>
                          <p className="text-sm font-medium">{formatShortDate(item.last_access)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Globe className="h-3 w-3" /> IP Addresses
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.ip_addresses.slice(0, 2).map((ip) => (
                              <Badge key={ip} variant="outline" className="text-xs font-mono">
                                {ip}
                              </Badge>
                            ))}
                            {item.ip_addresses.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{item.ip_addresses.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Key className="h-3 w-3" /> Actions
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(item.actions).map(([action, count]) => (
                              <Badge key={action} variant="outline" className="text-xs">
                                {ACCESS_ACTION_BADGES[action]?.label || action}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No access logs yet. Logs will appear here when users access the /live page.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Detailed Log Tab - Raw access logs */}
          <TabsContent value="detailed" className="space-y-4">
            {/* Filters */}
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {showFilters ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Action</Label>
                        <Select value={actionFilter || "all"} onValueChange={(v) => setActionFilter(v === "all" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="All actions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All actions</SelectItem>
                            {actionTypes?.map(action => (
                              <SelectItem key={action} value={action}>
                                {ACCESS_ACTION_BADGES[action]?.label || action}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="SUCCESS">Success</SelectItem>
                            <SelectItem value="FAIL">Fail</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>From Date</Label>
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>To Date</Label>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>

            <Card>
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : logs && logs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Party</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                          <TableCell className="font-medium">{log.party_name}</TableCell>
                          <TableCell>{getAccessActionBadge(log.action)}</TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="font-mono text-sm">{log.ip_address || "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatShortDate(log.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No access logs found. Logs will appear when users access the /live page.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Activity Log Detail Dialog */}
        <Dialog open={!!selectedActivityLog} onOpenChange={() => setSelectedActivityLog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Log Details
              </DialogTitle>
            </DialogHeader>
            {selectedActivityLog && (
              <div className="space-y-6">
                {/* User and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">User</p>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{selectedActivityLog.user_email}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Time</p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{formatFullDate(selectedActivityLog.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Action and Entity Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Action</p>
                    {getActivityActionBadge(selectedActivityLog.action)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Entity Type</p>
                    {getEntityTypeBadge(selectedActivityLog.entity_type)}
                  </div>
                </div>

                {/* Entity ID */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Entity ID</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{selectedActivityLog.entity_id}</code>
                </div>

                {/* Meta Details */}
                {selectedActivityLog.meta && renderMetaJson(selectedActivityLog.meta, "Details")}

                {/* Changes (Before/After) */}
                {selectedActivityLog.changes && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Changes</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {(selectedActivityLog.changes as Record<string, unknown>)?.before && (
                        <div className="space-y-2">
                          <Badge variant="outline">Before</Badge>
                          <pre className="text-xs bg-red-500/5 border border-red-500/20 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                            {JSON.stringify((selectedActivityLog.changes as Record<string, unknown>).before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {(selectedActivityLog.changes as Record<string, unknown>)?.after && (
                        <div className="space-y-2">
                          <Badge variant="default">After</Badge>
                          <pre className="text-xs bg-green-500/5 border border-green-500/20 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                            {JSON.stringify((selectedActivityLog.changes as Record<string, unknown>).after, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Access Log Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Access Log Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Party</p>
                    <p className="font-medium">{selectedLog.party_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Action</p>
                    {getAccessActionBadge(selectedLog.action)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedLog.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="text-sm">{formatDate(selectedLog.created_at)}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">IP Address</p>
                  <p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Route</p>
                  <p className="font-mono text-sm">{selectedLog.route || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">User Agent</p>
                  <p className="text-xs text-muted-foreground break-all">{selectedLog.user_agent || "-"}</p>
                </div>
                {selectedLog.meta && renderMetaJson(selectedLog.meta, "Additional Info")}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );

  return embedded ? inner : <AppLayout>{inner}</AppLayout>;
}
