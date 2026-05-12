import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, AlertCircle, Loader2, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableSelect, SelectOption } from '@/components/ui/SearchableSelect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useActivePaypalAccounts } from '@/hooks/usePaypalAccounts';
import { useActivePaypalEmails } from '@/hooks/usePaypalEmails';
import { useParties } from '@/hooks/useParties';
import { useCreateBulkTransactions } from '@/hooks/useTransactions';
import { useCreateBulkPartyTransactions } from '@/hooks/usePartyTransactions';
import { formatUSD, formatNumber } from '@/lib/format';
import { TxnType, Party } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkRow {
  id: string;
  txnDate: string;
  partyId: string;
  txnType: TxnType;
  walletId: string;
  emailId: string;
  amount: string;
  rate: string;
  remark: string;
  error?: string;
  rateAutoFilled?: boolean;
  rateOverridden?: boolean; // Track if user manually edited rate
}

const createEmptyRow = (prevRow?: BulkRow, parties?: Party[]): BulkRow => {
  const newRow: BulkRow = {
    id: crypto.randomUUID(),
    txnDate: prevRow?.txnDate || format(new Date(), 'yyyy-MM-dd'),
    partyId: prevRow?.partyId || '',
    txnType: prevRow?.txnType || 'INCOMING',
    walletId: '',
    emailId: '',
    amount: '',
    rate: '',
    remark: '',
    rateAutoFilled: false,
    rateOverridden: false,
  };
  
  // Auto-fill rate from party's default_rate when copying party
  if (newRow.partyId && parties) {
    const party = parties.find(p => p.id === newRow.partyId);
    if (party?.default_rate) {
      newRow.rate = party.default_rate.toString();
      newRow.rateAutoFilled = true;
    }
  }
  
  return newRow;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkTransactionModal({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  
  const { data: walletAccounts } = useActivePaypalAccounts();
  const { data: parties } = useParties();
  const createBulk = useCreateBulkTransactions();
  const createPartyTxns = useCreateBulkPartyTransactions();

  // Reset rows when modal opens
  useEffect(() => {
    if (open) {
      setRows([createEmptyRow(undefined, parties)]);
    }
  }, [open, parties]);

  const partyOptions: SelectOption[] = useMemo(() => {
    return parties?.map(p => ({
      value: p.id,
      label: p.party_name,
    })) || [];
  }, [parties]);

  const walletOptions: SelectOption[] = useMemo(() => {
    return walletAccounts?.map(w => ({
      value: w.id,
      label: w.paypal_name,
      tag: (w as any).tag || undefined,
    })) || [];
  }, [walletAccounts]);

  const addRows = (count: number) => {
    const lastRow = rows[rows.length - 1];
    const newRows = Array.from({ length: count }, () => createEmptyRow(lastRow, parties));
    setRows([...rows, ...newRows]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof BulkRow, value: string) => {
    setRows(rows.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value, error: undefined };
      
      // Auto-fill rate when party changes (only if not manually overridden and rate is empty)
      if (field === 'partyId' && value && !row.rateOverridden) {
        const party = parties?.find(p => p.id === value);
        if (party?.default_rate) {
          updated.rate = party.default_rate.toString();
          updated.rateAutoFilled = true;
        }
      }
      
      // Clear email when wallet changes
      if (field === 'walletId') {
        updated.emailId = '';
      }
      
      // Mark rate as manually overridden when user edits it
      if (field === 'rate') {
        updated.rateAutoFilled = false;
        updated.rateOverridden = true;
      }
      
      return updated;
    }));
  };

  const isRowEmpty = (row: BulkRow) => {
    return !row.partyId && !row.walletId && (!row.amount || row.amount === '0') && !row.rate;
  };

  const handleSave = async () => {
    // Filter out completely empty rows
    const nonEmptyRows = rows.filter(row => !isRowEmpty(row));
    
    if (nonEmptyRows.length === 0) {
      toast.error('No transactions to save');
      return;
    }

    // Validate only non-empty rows
    let hasErrors = false;
    const validatedRows = rows.map(row => {
      if (isRowEmpty(row)) return { ...row, error: undefined }; // Skip empty rows
      const error = !row.partyId ? 'Party required' :
                    !row.walletId ? 'Wallet required' :
                    !row.amount || parseFloat(row.amount) <= 0 ? 'Valid amount required' :
                    !row.rate || parseFloat(row.rate) <= 0 ? 'Valid rate required' : null;
      if (error) hasErrors = true;
      return { ...row, error: error || undefined };
    });
    
    setRows(validatedRows);
    
    if (hasErrors) {
      toast.error('Please fix validation errors');
      return;
    }

    // Only save non-empty rows
    const rowsToSave = validatedRows.filter(row => !isRowEmpty(row));
    
    // Prepare transactions
    const transactions = rowsToSave.map(row => ({
      txn_date: row.txnDate,
      txn_type: row.txnType,
      party_id: row.partyId,
      paypal_account_id: row.walletId,
      paypal_email_id: row.emailId || null,
      amount: parseFloat(row.amount),
      rate: parseFloat(row.rate),
      total: parseFloat(row.amount) * parseFloat(row.rate),
      remark: row.remark || undefined,
    }));

    try {
      const savedTxns = await createBulk.mutateAsync(transactions);
      
      // Auto-create party_transaction entries with remark format (amount*rate)
      const partyEntries = savedTxns.map((txn, idx) => {
        const row = rowsToSave[idx];
        const amount = parseFloat(row.amount);
        const rate = parseFloat(row.rate);
        const total = amount * rate;
        
        // Build remark: "UserRemark, (amount*rate)" or just "(amount*rate)"
        const autoRemark = `(${amount}*${rate})`;
        const finalRemark = row.remark ? `${row.remark}, ${autoRemark}` : autoRemark;
        
        return {
          party_id: txn.party_id,
          entry_date: txn.txn_date,
          entry_type: txn.txn_type === 'INCOMING' ? 'INCOMING' as const : 'OUTGOING' as const,
          amount_npr: total,
          remark: finalRemark,
          source_transaction_id: txn.id,
        };
      });
      
      await createPartyTxns.mutateAsync(partyEntries);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const filledRowCount = useMemo(() => {
    return rows.filter(row => !isRowEmpty(row)).length;
  }, [rows]);

  const grandTotalNPR = useMemo(() => {
    return rows.reduce((sum, row) => {
      const amount = parseFloat(row.amount) || 0;
      const rate = parseFloat(row.rate) || 0;
      return sum + (amount * rate);
    }, 0);
  }, [rows]);

  const grandTotalUSD = useMemo(() => {
    return rows.reduce((sum, row) => {
      return sum + (parseFloat(row.amount) || 0);
    }, 0);
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-[95vw] max-h-[90vh] flex flex-col p-4 md:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base md:text-lg">Bulk Transaction Entry</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-wrap gap-2 mb-3 md:mb-4">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addRows(1)}>
            <Plus className="h-3 w-3 mr-1" /> +1
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addRows(5)}>
            <Plus className="h-3 w-3 mr-1" /> +5
          </Button>
          <div className="ml-auto text-xs text-muted-foreground flex items-center">
            {rows.filter(r => !isRowEmpty(r)).length} row(s) • <span className="font-semibold text-foreground ml-1">{formatUSD(grandTotalUSD)}</span>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 -mx-4 px-4 md:-mx-6 md:px-6">
          <div className="space-y-3">
            {/* Desktop Header - Hidden on mobile */}
            <div className="hidden md:grid grid-cols-[100px_1fr_120px_1fr_1fr_100px_100px_120px_1fr_40px] gap-2 text-xs font-medium text-muted-foreground sticky top-0 bg-background py-2">
              <div>Date</div>
              <div>Party</div>
              <div>Type</div>
              <div>Wallet</div>
              <div>Email</div>
              <div>Amount</div>
              <div>Rate</div>
              <div>NPR Total</div>
              <div>Remark</div>
              <div></div>
            </div>

            {rows.map((row, index) => (
              <BulkRowInput
                key={row.id}
                row={row}
                index={index}
                walletAccounts={walletAccounts || []}
                parties={parties || []}
                partyOptions={partyOptions}
                walletOptions={walletOptions}
                onUpdate={(field, value) => updateRow(row.id, field, value)}
                onRemove={() => removeRow(row.id)}
                canRemove={rows.length > 1}
              />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-3 md:mt-4 flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 md:flex-none" onClick={handleSave} disabled={createBulk.isPending}>
            {createBulk.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save All (${filledRowCount})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BulkRowInputProps {
  row: BulkRow;
  index: number;
  walletAccounts: Array<{ id: string; paypal_name: string }>;
  parties: Party[];
  partyOptions: SelectOption[];
  walletOptions: SelectOption[];
  onUpdate: (field: keyof BulkRow, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function BulkRowInput({ row, index, walletAccounts, parties, partyOptions, walletOptions, onUpdate, onRemove, canRemove }: BulkRowInputProps) {
  const { data: activeEmails, isLoading: emailsLoading } = useActivePaypalEmails(row.walletId);
  
  const hasEmails = activeEmails && activeEmails.length > 0;
  
  const total = useMemo(() => {
    const amount = parseFloat(row.amount) || 0;
    const rate = parseFloat(row.rate) || 0;
    return amount * rate;
  }, [row.amount, row.rate]);

  const emailOptions: SelectOption[] = useMemo(() => {
    return activeEmails?.map(e => ({
      value: e.id,
      label: e.email,
      sublabel: e.is_primary ? '⭐ Primary' : undefined,
    })) || [];
  }, [activeEmails]);

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div className="space-y-1">
      {/* Mobile Layout - Card style */}
      <div className="md:hidden bg-card border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRemove}
            disabled={!canRemove}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
        
        {/* Row 1: Date + Type */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Date</label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 w-full justify-start text-left font-normal text-xs px-2",
                    !row.txnDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {row.txnDate ? format(new Date(row.txnDate), "MMM d") : "Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={row.txnDate ? new Date(row.txnDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      onUpdate('txnDate', format(date, 'yyyy-MM-dd'));
                    }
                    setDatePickerOpen(false);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Type</label>
            <Select value={row.txnType} onValueChange={(v) => onUpdate('txnType', v as TxnType)}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="INCOMING" className="text-xs">Incoming</SelectItem>
                <SelectItem value="OUTGOING" className="text-xs">Outgoing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Party */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Party</label>
          <SearchableSelect
            options={partyOptions}
            value={row.partyId}
            onValueChange={(v) => onUpdate('partyId', v)}
            placeholder="Select party..."
            searchPlaceholder="Search parties..."
            size="sm"
          />
        </div>

        {/* Row 3: Wallet + Email */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Wallet</label>
            <SearchableSelect
              options={walletOptions}
              value={row.walletId}
              onValueChange={(v) => onUpdate('walletId', v)}
              placeholder="Wallet..."
              searchPlaceholder="Search wallets..."
              size="sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Email</label>
            {hasEmails ? (
              <SearchableSelect
                options={emailOptions}
                value={row.emailId}
                onValueChange={(v) => onUpdate('emailId', v)}
                placeholder="Email..."
                searchPlaceholder="Search emails..."
                disabled={!row.walletId || emailsLoading}
                size="sm"
              />
            ) : (
              <Input
                type="text"
                value={row.walletId ? 'No emails' : '-'}
                readOnly
                disabled
                className="h-8 text-xs bg-muted"
              />
            )}
          </div>
        </div>

        {/* Row 4: Amount + Rate + Total */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Amount</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  onUpdate('amount', val);
                }
              }}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1 relative">
            <label className="text-[10px] text-muted-foreground">
              Rate {row.rateAutoFilled && <span className="text-success">(Auto)</span>}
            </label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Rate"
              value={row.rate}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  onUpdate('rate', val);
                }
              }}
              className={`h-8 text-xs ${row.rateAutoFilled ? 'border-success/50' : ''}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">NPR Total</label>
            <Input
              type="text"
              value={formatNumber(total)}
              readOnly
              className="h-8 text-xs bg-muted font-semibold"
            />
          </div>
        </div>

        {/* Row 5: Remark */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Remark</label>
          <Input
            type="text"
            placeholder="Note..."
            value={row.remark}
            onChange={(e) => onUpdate('remark', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Error display */}
        {row.error && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            {row.error}
          </div>
        )}
      </div>

      {/* Desktop Layout - Grid style */}
      <div className="hidden md:block space-y-1">
        <div className="grid grid-cols-[100px_1fr_120px_1fr_1fr_100px_100px_120px_1fr_40px] gap-2 items-center">
          {/* Date with Calendar Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 w-full justify-start text-left font-normal text-xs px-2",
                  !row.txnDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1 h-3 w-3" />
                {row.txnDate ? format(new Date(row.txnDate), "MMM d") : "Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={row.txnDate ? new Date(row.txnDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    onUpdate('txnDate', format(date, 'yyyy-MM-dd'));
                  }
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Party - Searchable */}
          <SearchableSelect
            options={partyOptions}
            value={row.partyId}
            onValueChange={(v) => onUpdate('partyId', v)}
            placeholder="Party..."
            searchPlaceholder="Search parties..."
            size="sm"
          />

          {/* Type */}
          <Select value={row.txnType} onValueChange={(v) => onUpdate('txnType', v as TxnType)}>
            <SelectTrigger className="h-9 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="INCOMING" className="text-xs">Incoming</SelectItem>
              <SelectItem value="OUTGOING" className="text-xs">Outgoing</SelectItem>
            </SelectContent>
          </Select>

          {/* Wallet - Searchable */}
          <SearchableSelect
            options={walletOptions}
            value={row.walletId}
            onValueChange={(v) => onUpdate('walletId', v)}
            placeholder="Wallet..."
            searchPlaceholder="Search wallets..."
            size="sm"
          />

          {/* Email - Searchable (only if wallet has emails) */}
          {hasEmails ? (
            <SearchableSelect
              options={emailOptions}
              value={row.emailId}
              onValueChange={(v) => onUpdate('emailId', v)}
              placeholder="Email..."
              searchPlaceholder="Search emails..."
              disabled={!row.walletId || emailsLoading}
              size="sm"
            />
          ) : (
            <Input
              type="text"
              value={row.walletId ? 'No emails' : 'Select wallet'}
              readOnly
              disabled
              className="h-9 text-xs bg-muted"
            />
          )}

          {/* Amount - plain text input, no spinner */}
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={row.amount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                onUpdate('amount', val);
              }
            }}
            className="h-9 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          {/* Rate */}
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Rate"
              value={row.rate}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  onUpdate('rate', val);
                }
              }}
              className={`h-9 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${row.rateAutoFilled ? 'border-success/50' : ''}`}
            />
            {row.rateAutoFilled && (
              <span className="absolute -top-4 left-0 text-[10px] text-success">Auto</span>
            )}
          </div>

          {/* Total (NPR) */}
          <Input
            type="text"
            value={formatNumber(total)}
            readOnly
            className="h-9 text-xs bg-muted font-semibold"
          />

          {/* Remark */}
          <Input
            type="text"
            placeholder="Note..."
            value={row.remark}
            onChange={(e) => onUpdate('remark', e.target.value)}
            className="h-9 text-xs"
          />

          {/* Remove */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onRemove}
            disabled={!canRemove}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        {/* Error display */}
        {row.error && (
          <div className="flex items-center gap-1 text-xs text-destructive pl-2">
            <AlertCircle className="h-3 w-3" />
            {row.error}
          </div>
        )}
      </div>
    </div>
  );
}
