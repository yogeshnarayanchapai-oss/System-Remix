import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NepaliAccount, NepaliAccountStatus, useCreateNepaliAccount, useUpdateNepaliAccount } from '@/hooks/useNepaliAccounts';

interface NepaliAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account?: NepaliAccount | null;
}

export function NepaliAccountModal({ isOpen, onClose, account }: NepaliAccountModalProps) {
  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [status, setStatus] = useState<NepaliAccountStatus>('ACTIVE');
  const [showBalanceConfirm, setShowBalanceConfirm] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const createMutation = useCreateNepaliAccount();
  const updateMutation = useUpdateNepaliAccount();

  const isEditing = !!account;
  const originalBalance = account?.opening_balance_npr ?? 0;

  useEffect(() => {
    if (account) {
      setName(account.name);
      setOpeningBalance(account.opening_balance_npr.toString());
      setStatus(account.status);
    } else {
      setName('');
      setOpeningBalance('0');
      setStatus('ACTIVE');
    }
  }, [account, isOpen]);

  const handleSubmit = () => {
    const balanceChanged = isEditing && Number(openingBalance) !== originalBalance;
    
    if (balanceChanged && !pendingSubmit) {
      setShowBalanceConfirm(true);
      return;
    }

    const data = {
      name: name.trim(),
      opening_balance_npr: Number(openingBalance),
      status,
    };

    if (isEditing && account) {
      updateMutation.mutate({ id: account.id, ...data }, {
        onSuccess: () => {
          onClose();
          setPendingSubmit(false);
        },
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          onClose();
          setPendingSubmit(false);
        },
      });
    }
  };

  const handleBalanceConfirm = () => {
    setShowBalanceConfirm(false);
    setPendingSubmit(true);
    handleSubmit();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Nepali Account' : 'Add Nepali Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter account name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Opening Balance (NPR)</Label>
              <Input
                id="openingBalance"
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as NepaliAccountStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
              {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showBalanceConfirm}
        onOpenChange={setShowBalanceConfirm}
        onConfirm={handleBalanceConfirm}
        title="Change Opening Balance?"
        description="Are you sure you want to change the Opening Balance? This will affect the available balance calculation."
        confirmLabel="Confirm"
        cancelLabel="Cancel"
      />
    </>
  );
}
