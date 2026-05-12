import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, TrendingUp, TrendingDown, Wallet, Search, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNPR, formatDate } from "@/lib/format";

const PARTY_SESSION_KEY = "party_session_token";

interface Transaction {
  id: string;
  entry_date: string;
  entry_type: string;
  amount_npr: number;
  remark: string | null;
  created_at: string;
}

interface Summary {
  receivable: number;
  payable: number;
  net: number;
  incomingCount: number;
  outgoingCount: number;
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const [partyName, setPartyName] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ receivable: 0, payable: 0, net: 0, incomingCount: 0, outgoingCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Validate session and fetch data
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem(PARTY_SESSION_KEY);
      if (!token) {
        navigate("/userlogin", { replace: true });
        return;
      }

      try {
        // Validate session
        const { data: sessionData, error: sessionError } = await supabase.functions.invoke("party-auth", {
          body: { action: "validate", session_token: token },
        });

        if (sessionError || !sessionData?.valid) {
          localStorage.removeItem(PARTY_SESSION_KEY);
          navigate("/userlogin", { replace: true });
          return;
        }

        setPartyName(sessionData.party_name);

        // Fetch transactions
        const { data: txnData, error: txnError } = await supabase.functions.invoke("party-auth", {
          body: { action: "get_transactions", session_token: token },
        });

        if (txnError) throw txnError;

        if (txnData?.success) {
          const txns = txnData.transactions || [];
          setTransactions(txns);
          
          // Calculate counts from party's perspective (reversed from admin)
          // Admin INCOMING = Party Outgoing, Admin OUTGOING = Party Incoming
          const incomingCount = txns.filter((t: Transaction) => t.entry_type === 'INCOMING').length;
          const outgoingCount = txns.filter((t: Transaction) => t.entry_type === 'OUTGOING').length;
          
          setSummary({
            ...(txnData.summary || { receivable: 0, payable: 0, net: 0 }),
            incomingCount,
            outgoingCount,
          });
        }
      } catch (err) {
        console.error("Fetch error:", err);
        localStorage.removeItem(PARTY_SESSION_KEY);
        navigate("/userlogin", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = async () => {
    const token = localStorage.getItem(PARTY_SESSION_KEY);
    
    try {
      await supabase.functions.invoke("party-auth", {
        body: { action: "logout", session_token: token },
      });
    } catch (err) {
      console.error("Logout error:", err);
    }

    localStorage.removeItem(PARTY_SESSION_KEY);
    toast.success("Logged out successfully");
    navigate("/userlogin", { replace: true });
  };

  // Filter transactions by date range first (for totals calculation)
  const dateFilteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(t => t.entry_date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(t => t.entry_date <= dateTo);
    }

    return filtered;
  }, [transactions, dateFrom, dateTo]);

  // Calculate date-filtered totals for Incoming/Outgoing cards
  // Party perspective: Admin's OUTGOING = Party's Incoming, Admin's INCOMING = Party's Outgoing
  const { incomingTotal, outgoingTotal } = useMemo(() => {
    const incoming = dateFilteredTransactions
      .filter(t => t.entry_type === 'OUTGOING') // Admin OUTGOING = Party Incoming
      .reduce((sum, t) => sum + t.amount_npr, 0);
    
    const outgoing = dateFilteredTransactions
      .filter(t => t.entry_type === 'INCOMING') // Admin INCOMING = Party Outgoing
      .reduce((sum, t) => sum + t.amount_npr, 0);
    
    return { incomingTotal: incoming, outgoingTotal: outgoing };
  }, [dateFilteredTransactions]);

  // Calculate all-time net balance for Receivable/Payable card
  // Net = Total Incoming - Total Outgoing (from party perspective)
  const { netBalance, isReceivable } = useMemo(() => {
    const allIncoming = transactions
      .filter(t => t.entry_type === 'OUTGOING')
      .reduce((sum, t) => sum + t.amount_npr, 0);
    
    const allOutgoing = transactions
      .filter(t => t.entry_type === 'INCOMING')
      .reduce((sum, t) => sum + t.amount_npr, 0);
    
    const net = allIncoming - allOutgoing;
    return { netBalance: Math.abs(net), isReceivable: net < 0 };
  }, [transactions]);

  // Filter transactions for display
  const filteredTransactions = useMemo(() => {
    let filtered = [...dateFilteredTransactions];

    // Filter by tab (from party's perspective - reversed)
    if (activeTab === "incoming") {
      filtered = filtered.filter(t => t.entry_type === "OUTGOING");
    } else if (activeTab === "outgoing") {
      filtered = filtered.filter(t => t.entry_type === "INCOMING");
    }

    // Filter by search (remark)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.remark?.toLowerCase().includes(query)
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

    return filtered;
  }, [dateFilteredTransactions, activeTab, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Party Dashboard</h1>
            <p className="text-sm opacity-80">{partyName}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards - From Party's Perspective */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Incoming Total NPR - Date filtered */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Incoming</CardTitle>
              <TrendingDown className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-success">{formatNPR(incomingTotal)}</div>
              <p className="text-xs text-muted-foreground">
                {dateFilteredTransactions.filter(t => t.entry_type === 'OUTGOING').length} transactions
              </p>
            </CardContent>
          </Card>

          {/* Outgoing Total NPR - Date filtered */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outgoing</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-destructive">{formatNPR(outgoingTotal)}</div>
              <p className="text-xs text-muted-foreground">
                {dateFilteredTransactions.filter(t => t.entry_type === 'INCOMING').length} transactions
              </p>
            </CardContent>
          </Card>

          {/* Net Receivable or Payable - All time, based on calculation */}
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isReceivable ? 'Net Receivable' : 'Net Payable'}
              </CardTitle>
              <Wallet className={`h-4 w-4 ${isReceivable ? 'text-success' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${isReceivable ? 'text-success' : 'text-destructive'}`}>
                {formatNPR(netBalance)}
              </div>
              <p className="text-xs text-muted-foreground">
                {isReceivable ? 'लिनुपर्ने' : 'दिनुपर्ने'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by remark..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-auto"
                  placeholder="From"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-auto"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="incoming">Incoming</TabsTrigger>
                <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                <div className="table-container">
                  <Table>
                    <TableHeader className="table-sticky-header">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount (NPR)</TableHead>
                        <TableHead>Remark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((txn) => {
                          // Party's perspective: Admin OUTGOING = Party Incoming, Admin INCOMING = Party Outgoing
                          const isIncoming = txn.entry_type === 'OUTGOING';
                          return (
                            <TableRow key={txn.id}>
                              <TableCell>{formatDate(txn.entry_date)}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  isIncoming 
                                    ? 'bg-success/10 text-success' 
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {isIncoming ? 'Incoming' : 'Outgoing'}
                                </span>
                              </TableCell>
                              <TableCell className={`text-right font-mono ${
                                isIncoming ? 'text-success' : 'text-destructive'
                              }`}>
                                {formatNPR(txn.amount_npr)}
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-[300px] truncate">
                                {txn.remark || '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {filteredTransactions.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}