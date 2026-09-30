import { useState } from 'react';
import { 
  BarChart3, 
  Mail, 
  CreditCard,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  MailX
} from 'lucide-react';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  useEmailPerformance, 
  usePaypalSummary,
  useEmailsWithNoActivity
} from '@/hooks/useDashboard';
import { PartyAnalytics } from '@/components/reports/PartyAnalytics';
import { useTransactions } from '@/hooks/useTransactions';
import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatUSD } from '@/lib/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type InactiveDatePreset = '7' | '15' | '30' | 'custom';

export default function Reports() {
  const [emailDays, setEmailDays] = useState<7 | 30>(7);
  const [inactivePreset, setInactivePreset] = useState<InactiveDatePreset>('30');
  const [inactiveDateFrom, setInactiveDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [inactiveDateTo, setInactiveDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Update date range when preset changes
  const handlePresetChange = (preset: InactiveDatePreset) => {
    setInactivePreset(preset);
    if (preset !== 'custom') {
      const days = parseInt(preset);
      setInactiveDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
      setInactiveDateTo(format(new Date(), 'yyyy-MM-dd'));
    }
  };
  
  const { data: emailPerformance7d, isLoading: email7dLoading } = useEmailPerformance(7);
  const { data: emailPerformance30d, isLoading: email30dLoading } = useEmailPerformance(30);
  const { data: paypalSummary, isLoading: paypalLoading } = usePaypalSummary();
  const { data: inactiveEmails, isLoading: inactiveLoading } = useEmailsWithNoActivity(inactiveDateFrom, inactiveDateTo);
  const { isVisible: showSensitive, MASK } = useSensitiveDataVisibility();
  
  // Get last 30 days of transactions for daily chart
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const { data: recentTransactions, isLoading: txnLoading } = useTransactions({
    dateFrom: thirtyDaysAgo,
  });

  // Calculate daily totals - USD only (using amount, not total)
  const dailyData = (() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date(),
    });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTxns = recentTransactions?.filter(t => t.txn_date === dateStr) || [];
      
      let incoming = 0;
      let outgoing = 0;
      
      dayTxns.forEach(txn => {
        if (txn.txn_type === 'INCOMING') {
          incoming += txn.amount; // USD amount
        } else {
          outgoing += txn.amount; // USD amount
        }
      });

      return {
        date: format(day, 'MMM d'),
        incoming,
        outgoing,
      };
    });
  })();

  const emailPerformance = emailDays === 7 ? emailPerformance7d : emailPerformance30d;
  const emailLoading = emailDays === 7 ? email7dLoading : email30dLoading;

  return (
    <AppLayout>
      <PageHeader 
        title="Reports" 
        description="Detailed analytics and performance metrics"
      />

      {/* Quick jump nav */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: 'parties', label: 'Parties' },
          { id: 'wallets', label: 'Wallets' },
          { id: 'daily', label: 'Daily' },
          { id: 'inactive', label: 'Inactive' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* High Value Customer Analytics */}
      <div id="section-parties" className="scroll-mt-20">
        <PartyAnalytics />
      </div>

      {/* Wallet In/Out Report - USD */}
      <Card id="section-wallets" className="scroll-mt-20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Wallet In/Out Report</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="table-container max-h-[400px]">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paypalLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(4)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paypalSummary?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No wallet accounts
                    </TableCell>
                  </TableRow>
                ) : (
                  paypalSummary?.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.paypal_name}</TableCell>
                      <TableCell className="text-right currency-positive">
                        {showSensitive ? formatUSD(account.total_received) : MASK}
                      </TableCell>
                      <TableCell className="text-right currency-negative">
                        {showSensitive ? formatUSD(account.total_sent) : MASK}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {showSensitive ? formatUSD(account.balance) : MASK}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>


      {/* Daily Breakdown Table - USD */}
      <Card id="section-daily" className="mt-6 scroll-mt-20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Daily Breakdown (Last 30 Days)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="table-container max-h-[400px]">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <ArrowDownLeft className="h-4 w-4 text-success" />
                      Incoming
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <ArrowUpRight className="h-4 w-4 text-outgoing" />
                      Outgoing
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txnLoading ? (
                  [...Array(7)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(4)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  [...dailyData].reverse().filter(d => d.incoming > 0 || d.outgoing > 0).map((day, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{day.date}</TableCell>
                      <TableCell className="text-right currency-positive">
                        {showSensitive ? formatUSD(day.incoming) : MASK}
                      </TableCell>
                      <TableCell className="text-right currency-negative">
                        {showSensitive ? formatUSD(day.outgoing) : MASK}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {showSensitive ? (
                          <span className={day.incoming - day.outgoing >= 0 ? 'currency-positive' : 'currency-negative'}>
                            {formatUSD(day.incoming - day.outgoing)}
                          </span>
                        ) : MASK}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Inactive Emails Section */}
      <Card id="section-inactive" className="mt-6 scroll-mt-20">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <MailX className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Inactive Emails</CardTitle>
                <p className="text-sm text-muted-foreground">Emails with no transactions in date range</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={inactivePreset} onValueChange={(v) => handlePresetChange(v as InactiveDatePreset)}>
                <TabsList>
                  <TabsTrigger value="7">7 Days</TabsTrigger>
                  <TabsTrigger value="15">15 Days</TabsTrigger>
                  <TabsTrigger value="30">30 Days</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
              {inactivePreset === 'custom' && (
                <div className="flex items-center gap-2">
                  <div className="form-field">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={inactiveDateFrom}
                      onChange={(e) => setInactiveDateFrom(e.target.value)}
                      className="h-9 w-[140px]"
                    />
                  </div>
                  <div className="form-field">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={inactiveDateTo}
                      onChange={(e) => setInactiveDateTo(e.target.value)}
                      className="h-9 w-[140px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-lg bg-warning/10 p-4 text-center">
            <p className="text-sm text-muted-foreground">Inactive Email Count</p>
            <p className="text-3xl font-bold text-warning">{inactiveLoading ? '-' : inactiveEmails?.length || 0}</p>
          </div>
          <div className="table-container max-h-[300px]">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-center">Incoming</TableHead>
                  <TableHead className="text-center">Outgoing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(5)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : inactiveEmails?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      All emails have activity in this date range
                    </TableCell>
                  </TableRow>
                ) : (
                  inactiveEmails?.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="font-medium">{email.email}</TableCell>
                      <TableCell className="text-muted-foreground">{email.paypal_name}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-success font-medium">{email.incoming_count}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-outgoing font-medium">{email.outgoing_count}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={email.status === 'ACTIVE' ? 'active' : 'inactive'}>
                          {email.status}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <div className="h-[80vh]" aria-hidden="true" />
    </AppLayout>
  );
}