import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSensitiveData } from '@/contexts/SensitiveDataContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export function GlobalSensitiveToggle() {
  const { toggle, verifyPin, toggleState, isRoleLoading, isAdmin, isPinVerified } = useSensitiveData();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pin, setPin] = useState('');

  if (isRoleLoading) {
    return null;
  }

  const handleClick = () => {
    if (toggleState) {
      // Currently visible → hide (no PIN needed)
      toggle();
    } else if (isAdmin) {
      if (isPinVerified) {
        // The PIN remains valid for 24 hours.
        toggle();
      } else {
        // Currently hidden & admin → ask for PIN
        setPin('');
        setShowPinDialog(true);
      }
    } else {
      // Editor → show restricted message
      toggle();
    }
  };

  const handlePinSubmit = () => {
    if (verifyPin(pin)) {
      setShowPinDialog(false);
      setPin('');
    } else {
      setPin('');
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick}
              className="h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              {toggleState ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{toggleState ? 'Hide sensitive data' : 'Show sensitive data'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Enter PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>PIN to view sensitive data</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              autoFocus
              maxLength={10}
              name="sensitive-pin-no-autofill"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinDialog(false)}>Cancel</Button>
            <Button onClick={handlePinSubmit} disabled={!pin}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
