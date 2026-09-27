import { useState } from 'react';
import { ArrowRightLeft, Search, MoreHorizontal, Trash2, Pencil, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useNprTransfers, DatePreset, NprTransfer } from '@/hooks/useNprTransfers';
import { useNepaliAccounts, useDeleteNprTransfer, useUpdateNprTransfer } from '@/hooks/useNepaliAccounts';
import { formatNPR } from '@/lib/format';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { NepaliAccountSelect } from '@/components/nepali-accounts/NepaliAccountSelect';
import { toast } from 'sonner';
import { downloadCsv } from '@/lib/csv';

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom' },
] as const;

export function NprTransfersTab() {
  const [datePreset, setDatePreset] = useState<DatePreset>('last7');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [nepaliAccountId, setNepaliAccountId] = useState<string>('all');
  const [remarkSearch, setRemarkSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NprTransfer | null>(null);
  const [editTarget, setEditTarget] = useState<NprTransfer | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editFromAccountId, setEditFromAccountId] = useState<string | null>(null);
  const [editToAccountId, setEditToAccountId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editRemark, setEditRemark] = useState('');

  const { data: nepaliAccounts } = useNepaliAccounts(true);
  const deleteMutation = useDeleteNprTransfer();
  const updateMutation = useUpdateNprTransfer();

  const { data: transfers, isLoading } = useNprTransfers({
    datePreset,
    customDateFrom: customDateFrom?.toISOString().split('T')[0],
    customDateTo: customDateTo?.toISOString().split('T')[0],
    nepaliAccountId,
    remarkSearch: remarkSearch.trim() || undefined,
  });

  const accountOptions = [
    { value: 'all', label: 'All Accounts' },
    ...(nepaliAccounts?.map(acc => ({ value: acc.id, label: acc.name })) || []),
  ];

  const handleExportCsv = () => {
    if (!transfers?.length) return;
    downloadCsv(
      `receivable-payable-transfers-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      ['Date', 'From Account', 'To Account', 'Amount (NPR)', 'Remark'],
      transfers.map((transfer) => [
        transfer.transfer_date,
        transfer.from_account_name,
        transfer.to_account_name,
        transfer.amount_npr,
        transfer.remark || '',
      ]),
    );
    toast.success(`Exported ${transfers.length} filtered transfers`);
  };

  const openEdit = async (transfer: NprTransfer) => {
    // Get source_id from ledger entry
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: entry } = await supabase
      .from('nepali_account_ledger')
      .select('source_id')
      .eq('id', transfer.id)
      .single();

    if (!entry?.source_id) {
      toast.error('Could not find transfer data');
      return;
    }

    setEditTarget({ ...transfer, id: entry.source_id });
    setEditDate(transfer.transfer_date);
    setEditFromAccountId(transfer.from_account_id);
    setEditToAccountId(transfer.to_account_id);
    setEditAmount(String(transfer.amount_npr));
    setEditRemark(transfer.remark || '');
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Invalid amount');
      return;
    }
    if (!editFromAccountId && !editToAccountId) {
      toast.error('Select at least one account');
      return;
    }
    if (editFromAccountId && editToAccountId && editFromAccountId === editToAccountId) {
      toast.error('From and To accounts must be different');
      return;
    }

    await updateMutation.mutateAsync({
      sourceId: editTarget.id, // we stored source_id here
      from_account_id: editFromAccountId,
      to_account_id: editToAccountId,
      amount_npr: amt,
      transfer_date: editDate,
      remark: editRemark || undefined,
    });
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // The transfer's id is the TRANSFER_OUT ledger entry id; we need source_id to delete both entries
    // Since useNprTransfers matches by date/amount/remark, we need to find the source_id
    // The id stored is the TRANSFER_OUT entry id, let's use it to find source_id
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: entry } = await supabase
      .from('nepali_account_ledger')
      .select('source_id')
      .eq('id', deleteTarget.id)
      .single();

    if (entry?.source_id) {
      await deleteMutation.mutateAsync({
        sourceId: entry.source_id,
        meta: {
          amount_npr: deleteTarget.amount_npr,
          from_account: deleteTarget.from_account_name,
          to_account: deleteTarget.to_account_name,
        },
      });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Date Preset */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date Range</label>
              <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {datePreset === 'custom' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[130px] h-9 justify-start text-left font-normal",
                          !customDateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateFrom ? format(customDateFrom, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[130px] h-9 justify-start text-left font-normal",
                          !customDateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateTo ? format(customDateTo, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {/* Nepali Account Filter */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nepali Account</label>
              <SearchableSelect
                options={accountOptions}
                value={nepaliAccountId}
                onValueChange={setNepaliAccountId}
                placeholder="All Accounts"
                className="w-[180px]"
              />
            </div>

            {/* Remark Search */}
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Search Remark</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by remark..."
                  value={remarkSearch}
                  onChange={(e) => setRemarkSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <Button
              variant="outline"
              className="h-9"
              onClick={handleExportCsv}
              disabled={!transfers?.length || isLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="table-container">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From Account</TableHead>
                  <TableHead>To Account</TableHead>
                  <TableHead className="text-right">Amount (NPR)</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !transfers?.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        icon={<ArrowRightLeft className="h-6 w-6" />}
                        title="No NPR transfers found"
                        description="Try adjusting filters or create a transfer"
                        className="my-8"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer) => (
                    <TableRow key={transfer.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(transfer.transfer_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{transfer.from_account_name}</TableCell>
                      <TableCell className="font-medium">{transfer.to_account_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNPR(transfer.amount_npr)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {transfer.remark || '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => openEdit(transfer)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(transfer)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {transfers && transfers.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground text-right">
              Showing {transfers.length} transfer{transfers.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete NPR Transfer"
        description={`Delete transfer of ${deleteTarget ? formatNPR(deleteTarget.amount_npr) : ''} from ${deleteTarget?.from_account_name} to ${deleteTarget?.to_account_name}?`}
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit NPR Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>From Account</Label>
              <NepaliAccountSelect
                value={editFromAccountId}
                onChange={setEditFromAccountId}
                placeholder="None"
              />
            </div>
            <div className="space-y-1.5">
              <Label>To Account</Label>
              <NepaliAccountSelect
                value={editToAccountId}
                onChange={setEditToAccountId}
                placeholder="None"
              />
              {editFromAccountId && editToAccountId && editFromAccountId === editToAccountId && (
                <p className="text-xs text-destructive">From and To must be different</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Amount (NPR)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) setEditAmount(val);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Remark</Label>
              <Input value={editRemark} onChange={(e) => setEditRemark(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
