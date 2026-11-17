import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect, SelectOption } from '@/components/ui/SearchableSelect';
import { NepaliAccountSelect } from '@/components/nepali-accounts/NepaliAccountSelect';
import { useActivePaypalAccounts } from '@/hooks/usePaypalAccounts';
import { useCreateWalletTransfer } from '@/hooks/useWalletTransfers';
import { useCreateNprTransfer, useNepaliAccounts } from '@/hooks/useNepaliAccounts';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { formatUSD, formatNPR } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferModal({ open, onOpenChange }: Props) {
  const [activeTab, setActiveTab] = useState<'usd' | 'npr'>('usd');

  // USD Transfer State
  const [usdDate, setUsdDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fromWalletId, setFromWalletId] = useState('__none__');
  const [toWalletId, setToWalletId] = useState('__none__');
  const [usdAmount, setUsdAmount] = useState('');
  const [fee, setFee] = useState('0');
  const [usdRemark, setUsdRemark] = useState('');

  // NPR Transfer State
  const [nprDate, setNprDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [nprAmount, setNprAmount] = useState('');
  const [nprRemark, setNprRemark] = useState('');

  const { data: wallets } = useActivePaypalAccounts();
  const createUsdTransfer = useCreateWalletTransfer();
  const createNprTransfer = useCreateNprTransfer();
  const { data: nepaliAccounts } = useNepaliAccounts(true);
  const { isAdmin } = useUserRole();
  const { user } = useAuth();

  // Live wallet balances from authoritative view
  const { data: walletBalances } = useQuery({
    queryKey: ['paypal-accounts-view-balances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paypal_accounts_with_balance')
        .select('id, balance');
      if (error) throw error;
      return data as { id: string; balance: number | null }[];
    },
    enabled: open,
  });

  // Live NPR balances from authoritative view
  const { data: nprBalances } = useQuery({
    queryKey: ['nepali-accounts-view-balances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nepali_accounts_with_balance')
        .select('id, available_balance_npr');
      if (error) throw error;
      return data as { id: string; available_balance_npr: number | null }[];
    },
    enabled: open,
  });

  const walletBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    walletBalances?.forEach(w => map.set(w.id as string, Number(w.balance) || 0));
    return map;
  }, [walletBalances]);

  const nprBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    nprBalances?.forEach(a => map.set(a.id as string, Number(a.available_balance_npr) || 0));
    return map;
  }, [nprBalances]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      // Reset USD
      setUsdDate(format(new Date(), 'yyyy-MM-dd'));
      setFromWalletId('__none__');
      setToWalletId('__none__');
      setUsdAmount('');
      setFee('0');
      setUsdRemark('');
      // Reset NPR
      setNprDate(format(new Date(), 'yyyy-MM-dd'));
      setFromAccountId(null);
      setToAccountId(null);
      setNprAmount('');
      setNprRemark('');
    }
  }, [open]);

  const walletOptionsWithNone: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = isAdmin ? [{ value: '__none__', label: 'None' }] : [];
    wallets?.forEach(w => opts.push({ value: w.id, label: w.paypal_name, tag: (w as any).tag || undefined }));
    return opts;
  }, [wallets, isAdmin]);

  const toWalletOptionsWithNone = useMemo(() => {
    return walletOptionsWithNone.filter(w => w.value === '__none__' || w.value !== fromWalletId);
  }, [walletOptionsWithNone, fromWalletId]);

  // USD validation
  const usdAmountNum = parseFloat(usdAmount) || 0;
  const feeNum = parseFloat(fee) || 0;
  const fromDeduction = usdAmountNum + feeNum;
  const toReceived = usdAmountNum;
  const actualFromId = fromWalletId === '__none__' ? null : fromWalletId;
  const actualToId = toWalletId === '__none__' ? null : toWalletId;
  const isUsdValid = (isAdmin
    ? (actualFromId || actualToId) !== null && !(actualFromId && actualToId && actualFromId === actualToId)
    : !!actualFromId && !!actualToId && actualFromId !== actualToId)
    && usdAmountNum > 0 && feeNum >= 0;

  // NPR: convert null to/from for None support
  const actualNprFromId = fromAccountId;
  const actualNprToId = toAccountId;

  // NPR validation
  const nprAmountNum = parseFloat(nprAmount) || 0;
  const isNprValid = (isAdmin
    ? !!(fromAccountId || toAccountId) && !(fromAccountId && toAccountId && fromAccountId === toAccountId)
    : !!fromAccountId && !!toAccountId && fromAccountId !== toAccountId)
    && nprAmountNum > 0;

  const handleUsdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUsdValid) return;

    await createUsdTransfer.mutateAsync({
      transfer_date: usdDate,
      from_wallet_id: actualFromId,
      to_wallet_id: actualToId,
      amount: usdAmountNum,
      fee: feeNum,
      remark: usdRemark || undefined,
    });

    onOpenChange(false);
  };

  const handleNprSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNprValid) return;

    await createNprTransfer.mutateAsync({
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount_npr: nprAmountNum,
      transfer_date: nprDate,
      remark: nprRemark.trim() || undefined,
    });

    onOpenChange(false);
  };

  const isPending = createUsdTransfer.isPending || createNprTransfer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'usd' | 'npr')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="usd">USD</TabsTrigger>
            <TabsTrigger value="npr">NPR</TabsTrigger>
          </TabsList>

          {/* USD Transfer Tab */}
          <TabsContent value="usd" className="mt-4">
            <form onSubmit={handleUsdSubmit} className="space-y-4">
              <div className="form-field">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={usdDate}
                  onChange={(e) => setUsdDate(e.target.value)}
                />
              </div>

              <div className="form-field">
                <Label>From Wallet</Label>
                 <SearchableSelect
                   options={walletOptionsWithNone}
                   value={fromWalletId}
                   onValueChange={setFromWalletId}
                  placeholder="Select source wallet..."
                  searchPlaceholder="Search wallets..."
                />
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="form-field">
                <Label>To Wallet</Label>
                 <SearchableSelect
                   options={toWalletOptionsWithNone}
                   value={toWalletId}
                   onValueChange={setToWalletId}
                  placeholder="Select destination wallet..."
                  searchPlaceholder="Search wallets..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-field">
                  <Label>Amount</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={usdAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setUsdAmount(val);
                      }
                    }}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="form-field">
                  <Label>Fee</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={fee}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setFee(val);
                      }
                    }}
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-muted p-2.5 space-y-1 text-xs">
                {actualFromId && (() => {
                  const after = (walletBalanceMap.get(actualFromId) ?? 0) - fromDeduction;
                  const fromName = wallets?.find(w => w.id === actualFromId)?.paypal_name ?? 'From';
                  return (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground truncate pr-2">
                        {fromName} after{feeNum > 0 ? ` (-${formatUSD(fromDeduction)} incl. fee)` : ''}:
                      </span>
                      <span className={`font-semibold ${after < 0 ? 'text-destructive' : ''}`}>{formatUSD(after)}</span>
                    </div>
                  );
                })()}
                {actualToId && (() => {
                  const after = (walletBalanceMap.get(actualToId) ?? 0) + toReceived;
                  const toName = wallets?.find(w => w.id === actualToId)?.paypal_name ?? 'To';
                  return (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground truncate pr-2">{toName} after:</span>
                      <span className="font-semibold text-success">{formatUSD(after)}</span>
                    </div>
                  );
                })()}
                {!actualFromId && !actualToId && (
                  <p className="text-muted-foreground">Select at least one wallet</p>
                )}
              </div>

              <div className="form-field">
                <Label>Remark</Label>
                <Input
                  type="text"
                  placeholder="Optional note..."
                  value={usdRemark}
                  onChange={(e) => setUsdRemark(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isUsdValid || isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Create Transfer'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* NPR Transfer Tab */}
          <TabsContent value="npr" className="mt-4">
            <form onSubmit={handleNprSubmit} className="space-y-4">
              <div className="form-field">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={nprDate}
                  onChange={(e) => setNprDate(e.target.value)}
                />
              </div>

              <div className="form-field">
                <Label>From Nepali Account</Label>
                <NepaliAccountSelect
                  value={fromAccountId}
                  onChange={setFromAccountId}
                  placeholder="Select source account"
                  allowNone={isAdmin}
                />
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="form-field">
                <Label>To Nepali Account</Label>
                <NepaliAccountSelect
                  value={toAccountId}
                  onChange={setToAccountId}
                  placeholder="Select destination account"
                  allowNone={isAdmin}
                />
                {fromAccountId && toAccountId === fromAccountId && (
                  <p className="text-xs text-destructive mt-1">Source and destination must be different</p>
                )}
              </div>

              <div className="form-field">
                <Label>Amount (NPR) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={nprAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setNprAmount(val);
                    }
                  }}
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Summary */}
              {(fromAccountId || toAccountId) && (
                <div className="rounded-lg bg-muted p-2.5 space-y-1 text-xs">
                  {fromAccountId && (() => {
                    const after = (nprBalanceMap.get(fromAccountId) ?? 0) - nprAmountNum;
                    const fromName = nepaliAccounts?.find(a => a.id === fromAccountId)?.name ?? 'From';
                    return (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground truncate pr-2">{fromName} after:</span>
                        <span className={`font-semibold ${after < 0 ? 'text-destructive' : ''}`}>{formatNPR(after)}</span>
                      </div>
                    );
                  })()}
                  {toAccountId && (() => {
                    const after = (nprBalanceMap.get(toAccountId) ?? 0) + nprAmountNum;
                    const toName = nepaliAccounts?.find(a => a.id === toAccountId)?.name ?? 'To';
                    return (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground truncate pr-2">{toName} after:</span>
                        <span className="font-semibold text-success">{formatNPR(after)}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="form-field">
                <Label>Remark</Label>
                <Textarea
                  placeholder="Optional remark"
                  rows={2}
                  value={nprRemark}
                  onChange={(e) => setNprRemark(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isNprValid || isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    'Create Transfer'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}