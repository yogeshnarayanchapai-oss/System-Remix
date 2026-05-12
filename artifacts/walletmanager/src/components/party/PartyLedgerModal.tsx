import { useState, useMemo, useEffect } from 'react';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { 
  Plus, 
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Scale,
  Trash2,
  Pencil,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NepaliAccountSelect } from '@/components/nepali-accounts/NepaliAccountSelect';
import { 
  usePartyTransactions, 
  useCreatePartyTransaction, 
  useDeletePartyTransaction,
  useUpdatePartyTransaction,
  PartyTransaction,
  PartyEntryType 
} from '@/hooks/usePartyTransactions';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { formatNPR, formatDate } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';

interface PartyInfo {
  id: string;
  party_name: string;
}

interface Props {
  party: PartyInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Nepali labels
const labels = {
  receivable: 'लिनुपर्ने',      // Receivable
  payable: 'दिनुपर्ने',        // Payable
  settled: 'सेटल भयो',         // Settled
  unsettled: 'सेटल भएको छैन',  // Unsettled
};

const entryTypeLabels: Record<PartyEntryType, { label: string; icon: React.ReactNode; variant: 'incoming' | 'outgoing' | 'settled' }> = {
  'INCOMING': { label: 'Incoming', icon: <ArrowDownLeft className="h-3 w-3 mr-1" />, variant: 'incoming' },
  'OUTGOING': { label: 'Outgoing', icon: <ArrowUpRight className="h-3 w-3 mr-1" />, variant: 'outgoing' },
};

type DateFilterType = '7days' | 'custom';

export function PartyLedgerModal({ party, open, onOpenChange }: Props) {
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [entryType, setEntryType] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entryRemark, setEntryRemark] = useState('');
  const [nepaliAccountId, setNepaliAccountId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartyTransaction | null>(null);
  
  // Edit state
  const [editTarget, setEditTarget] = useState<PartyTransaction | null>(null);
  const [editType, setEditType] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [editNepaliAccountId, setEditNepaliAccountId] = useState<string | null>(null);

  // Date filter state - default to 7 days
  const [dateFilter, setDateFilter] = useState<DateFilterType>('7days');
  const [customFromDate, setCustomFromDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customToDate, setCustomToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: transactions, isLoading } = usePartyTransactions(party?.id);
  const createEntry = useCreatePartyTransaction();
  const deleteEntry = useDeletePartyTransaction();
  const updateEntry = useUpdatePartyTransaction();
  const deleteTxn = useDeleteTransaction();

  // Filter transactions by date
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    let fromDate: Date;
    let toDate: Date;
    
    if (dateFilter === '7days') {
      fromDate = startOfDay(subDays(new Date(), 7));
      toDate = endOfDay(new Date());
    } else {
      fromDate = startOfDay(parseISO(customFromDate));
      toDate = endOfDay(parseISO(customToDate));
    }
    
    return transactions.filter(txn => {
      const txnDate = parseISO(txn.entry_date);
      return isWithinInterval(txnDate, { start: fromDate, end: toDate });
    });
  }, [transactions, dateFilter, customFromDate, customToDate]);

  // Calculate ALL-TIME totals from ALL party_transactions (not filtered by date)
  // This ensures summary cards always match the Dashboard's party summary
  // OUTGOING = लिनुपर्ने (Receivable), INCOMING = दिनुपर्ने (Payable)
  const summary = useMemo(() => {
    if (!transactions?.length) return { receivable: 0, payable: 0, net: 0 };
    
    let totalOutgoing = 0;
    let totalIncoming = 0;

    transactions.forEach(entry => {
      if (entry.entry_type === 'OUTGOING') {
        totalOutgoing += entry.amount_npr;
      } else if (entry.entry_type === 'INCOMING') {
        totalIncoming += entry.amount_npr;
      }
    });

    const net = totalOutgoing - totalIncoming;

    return {
      receivable: net > 0 ? net : 0,
      payable: net < 0 ? Math.abs(net) : 0,
      net,
    };
  }, [transactions]);

  // Auto-set entry type when opening new entry dialog based on party status
  // If payable (दिनुपर्ने) → default OUTGOING, if receivable (लिनुपर्ने) → default INCOMING
  const handleOpenNewEntry = () => {
    if (summary.payable > 0) {
      // Payable - default to OUTGOING to settle
      setEntryType('OUTGOING');
    } else if (summary.receivable > 0) {
      // Receivable - default to INCOMING to settle
      setEntryType('INCOMING');
    } else {
      // Settled - default to INCOMING
      setEntryType('INCOMING');
    }
    setShowNewEntry(true);
  };

  const handleNewEntry = async () => {
    if (!party?.id || !entryAmount) return;

    const amountNpr = parseFloat(entryAmount);
    if (amountNpr <= 0) return;

    await createEntry.mutateAsync({
      party_id: party.id,
      entry_date: entryDate,
      entry_type: entryType,
      amount_npr: amountNpr,
      remark: entryRemark || undefined,
      nepali_account_id: nepaliAccountId,
    });

    setShowNewEntry(false);
    setEntryAmount('');
    setEntryRemark('');
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    setNepaliAccountId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    // If this ledger row is linked to a transaction, delete the transaction.
    // Transaction delete will also remove the linked party_transactions row.
    if (deleteTarget.source_transaction_id) {
      await deleteTxn.mutateAsync(deleteTarget.source_transaction_id);
    } else {
      await deleteEntry.mutateAsync(deleteTarget.id);
    }

    setDeleteTarget(null);
  };

  const handleOpenEdit = (txn: PartyTransaction) => {
    setEditTarget(txn);
    setEditType(txn.entry_type as 'INCOMING' | 'OUTGOING');
    setEditAmount(txn.amount_npr.toString());
    setEditDate(txn.entry_date);
    setEditRemark(txn.remark || '');
    setEditNepaliAccountId(txn.nepali_account_id);
  };

  const handleEditSave = async () => {
    if (!editTarget || !editAmount) return;
    const amountNpr = parseFloat(editAmount);
    if (amountNpr <= 0) return;

    // Update the party transaction
    await updateEntry.mutateAsync({
      id: editTarget.id,
      data: {
        entry_type: editType,
        amount_npr: amountNpr,
        entry_date: editDate,
        remark: editRemark || null,
        nepali_account_id: editNepaliAccountId,
      },
    });

    // Update linked nepali_account_ledger if exists
    if (editTarget.nepali_account_id || editNepaliAccountId) {
      // Delete old ledger entry linked to this party txn
      await supabase
        .from('nepali_account_ledger')
        .delete()
        .eq('source_id', editTarget.id);

      // Create new ledger entry if account selected
      if (editNepaliAccountId) {
        const ledgerEntryType = editType === 'INCOMING' ? 'CREDIT' : 'DEBIT';
        const sourceType = editType === 'INCOMING' ? 'PARTY_RECEIVE' : 'PARTY_PAY';
        await supabase
          .from('nepali_account_ledger')
          .insert({
            nepali_account_id: editNepaliAccountId,
            entry_date: editDate,
            entry_type: ledgerEntryType,
            amount_npr: amountNpr,
            source_type: sourceType,
            source_id: editTarget.id,
            remark: editRemark || null,
          });
      }
    }

    setEditTarget(null);
  };

  const filteredSummary = useMemo(() => {
    if (!filteredTransactions.length) return { receivable: 0, payable: 0, net: 0 };
    let totalOut = 0, totalIn = 0;
    filteredTransactions.forEach(e => {
      if (e.entry_type === 'OUTGOING') totalOut += e.amount_npr;
      else if (e.entry_type === 'INCOMING') totalIn += e.amount_npr;
    });
    const net = totalOut - totalIn;
    return { receivable: net > 0 ? net : 0, payable: net < 0 ? Math.abs(net) : 0, net };
  }, [filteredTransactions]);

  const exportCSV = () => {
    if (!filteredTransactions?.length || !party) return;

    const fromStr = dateFilter === '7days'
      ? format(subDays(new Date(), 7), 'yyyy-MM-dd')
      : customFromDate;
    const toStr = dateFilter === '7days'
      ? format(new Date(), 'yyyy-MM-dd')
      : customToDate;

    // Build CSV with summary header
    const lines: string[] = [];
    lines.push(`Party Ledger: ${party.party_name}`);
    lines.push(`Period: ${fromStr} to ${toStr}`);
    lines.push('');
    lines.push(`Receivable (NPR),Payable (NPR),Net Position (NPR)`);
    lines.push(`${filteredSummary.receivable.toFixed(2)},${filteredSummary.payable.toFixed(2)},${filteredSummary.net.toFixed(2)}`);
    lines.push('');
    lines.push('Date,Type,Amount (NPR),Remark');
    filteredTransactions.forEach(txn => {
      const remark = (txn.remark || '').replace(/,/g, ' ').replace(/"/g, '""');
      lines.push(`${txn.entry_date},${txn.entry_type},${txn.amount_npr.toFixed(2)},"${remark}"`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${party.party_name}-ledger-${fromStr}-to-${toStr}.csv`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Party Ledger: {party?.party_name}
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge 
                variant={summary.receivable > 0 ? 'receivable' : summary.payable > 0 ? 'payable' : 'settled'}
              >
                {summary.receivable > 0 ? `${labels.receivable}: ${formatNPR(summary.receivable)}` : 
                 summary.payable > 0 ? `${labels.payable}: ${formatNPR(summary.payable)}` : labels.settled}
              </StatusBadge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-success/10 p-3 text-center">
            <p className="text-xs text-muted-foreground">{labels.receivable}</p>
            <p className="text-lg font-bold text-success">{formatNPR(summary.receivable)}</p>
          </div>
          <div className="rounded-lg bg-payable/10 p-3 text-center">
            <p className="text-xs text-muted-foreground">{labels.payable}</p>
            <p className="text-lg font-bold text-payable">{formatNPR(summary.payable)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <p className="text-xs text-muted-foreground">Net Position</p>
            <p className="text-lg font-bold text-primary">
              {summary.net > 0 ? `+${formatNPR(summary.net)}` : formatNPR(summary.net)}
            </p>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterType)}>
              <SelectTrigger className="w-[120px] h-8 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="w-[130px] h-8"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="w-[130px] h-8"
              />
            </div>
          )}
          
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredTransactions.length} entries
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          <Button onClick={handleOpenNewEntry}>
            <Plus className="h-4 w-4 mr-1" /> New Entry
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={!filteredTransactions?.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="table-sticky-header">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount (NPR)</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredTransactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No entries in selected date range
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions?.map((txn) => {
                  const typeInfo = entryTypeLabels[txn.entry_type as PartyEntryType];
                  const canDelete = true;
                  
                  return (
                    <TableRow key={txn.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(txn.entry_date)}</TableCell>
                      <TableCell>
                        <StatusBadge variant={typeInfo.variant}>
                          {typeInfo.icon}
                          {typeInfo.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatNPR(txn.amount_npr)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {txn.remark || '-'}
                      </TableCell>
                      <TableCell>
                        {canDelete && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              {!txn.source_transaction_id && (
                                <DropdownMenuItem onClick={() => handleOpenEdit(txn)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setDeleteTarget(txn)} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* New Entry Dialog */}
      <Dialog open={showNewEntry} onOpenChange={setShowNewEntry}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Entry - {party?.party_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="form-field">
              <Label>Entry Type</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as 'INCOMING' | 'OUTGOING')}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="INCOMING">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-success" />
                      Incoming
                    </span>
                  </SelectItem>
                  <SelectItem value="OUTGOING">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-payable" />
                      Outgoing
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {entryType === 'INCOMING' ? 'Party sent you money' : 'You sent money to party'}
              </p>
            </div>
            <div className="form-field">
              <Label>Amount (NPR)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={entryAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setEntryAmount(val);
                  }
                }}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="form-field">
              <Label>Date</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="form-field">
              <Label>Nepali Account</Label>
              <NepaliAccountSelect
                value={nepaliAccountId}
                onChange={setNepaliAccountId}
                placeholder="Select Nepali Account (Optional)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {nepaliAccountId ? 'Cash will be added/deducted from this account' : 'None = No cash movement'}
              </p>
            </div>
            <div className="form-field">
              <Label>Remark</Label>
              <Input
                type="text"
                placeholder="Optional note..."
                value={entryRemark}
                onChange={(e) => setEntryRemark(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEntry(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleNewEntry} 
              disabled={!entryAmount || parseFloat(entryAmount) <= 0 || createEntry.isPending}
            >
              {createEntry.isPending ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="form-field">
              <Label>Entry Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as 'INCOMING' | 'OUTGOING')}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="INCOMING">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-success" />
                      Incoming
                    </span>
                  </SelectItem>
                  <SelectItem value="OUTGOING">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-payable" />
                      Outgoing
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="form-field">
              <Label>Amount (NPR)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={editAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) setEditAmount(val);
                }}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="form-field">
              <Label>Date</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="form-field">
              <Label>Nepali Account</Label>
              <NepaliAccountSelect
                value={editNepaliAccountId}
                onChange={setEditNepaliAccountId}
                placeholder="Select Nepali Account (Optional)"
              />
            </div>
            <div className="form-field">
              <Label>Remark</Label>
              <Input type="text" placeholder="Optional note..." value={editRemark} onChange={(e) => setEditRemark(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={!editAmount || parseFloat(editAmount) <= 0 || updateEntry.isPending}>
              {updateEntry.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
         open={!!deleteTarget}
         onOpenChange={(open) => {
           if (!open) setDeleteTarget(null);
         }}
        title="Delete Entry"
         description="Are you sure you want to delete this entry? This will affect the ledger balance."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </Dialog>
  );
}
