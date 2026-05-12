import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ActiveAccount } from '@/lib/types';

interface ActiveAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: ActiveAccount | null;
  onSubmit: (data: {
    email: string;
    password: string;
    totp_secret?: string;
    is_primary?: boolean;
  }) => void;
  isLoading?: boolean;
}

export function ActiveAccountForm({ 
  open, 
  onOpenChange, 
  account, 
  onSubmit,
  isLoading 
}: ActiveAccountFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);

  useEffect(() => {
    if (account) {
      setEmail(account.email);
      setPassword(account.password);
      setTotpSecret(account.totp_secret || '');
      setIsPrimary(account.is_primary);
    } else {
      setEmail('');
      setPassword('');
      setTotpSecret('');
      setIsPrimary(false);
    }
    setShowPassword(false);
    setShowTotp(false);
  }, [account, open]);

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) return;
    
    onSubmit({
      email: email.trim(),
      password: password.trim(),
      totp_secret: totpSecret.trim() || undefined,
      is_primary: isPrimary,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {account ? 'Edit Account' : 'Add Account'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="form-field">
            <Label>Email *</Label>
            <Input
              type="email"
              placeholder="account@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="form-field">
            <Label>Password *</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="form-field">
            <Label>2FA Secret Code (for TOTP)</Label>
            <div className="relative">
              <Input
                type={showTotp ? 'text' : 'password'}
                placeholder="Enter 2FA secret key"
                value={totpSecret}
                onChange={(e) => setTotpSecret(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowTotp(!showTotp)}
              >
                {showTotp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Used to generate time-based 2FA codes
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-primary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked === true)}
            />
            <Label htmlFor="is-primary" className="font-normal cursor-pointer">
              Set as Primary Account
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Primary account credentials are shown on the public access page
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!email.trim() || !password.trim() || isLoading}
          >
            {account ? 'Save Changes' : 'Add Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
