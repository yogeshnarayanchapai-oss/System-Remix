import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNepaliAccounts } from '@/hooks/useNepaliAccounts';

interface NepaliAccountSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NepaliAccountSelect({ 
  value, 
  onChange, 
  placeholder = "Select Nepali Account",
  disabled = false 
}: NepaliAccountSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: accounts, isLoading } = useNepaliAccounts(true); // Only active accounts

  const selectedAccount = useMemo(() => {
    if (!value || !accounts) return null;
    return accounts.find(acc => acc.id === value);
  }, [value, accounts]);

  const handleSelect = (accountId: string) => {
    if (accountId === 'none') {
      onChange(null);
    } else {
      onChange(accountId);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          {selectedAccount ? selectedAccount.name : "None"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => handleSelect('none')}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === null ? "opacity-100" : "opacity-0"
                  )}
                />
                None
              </CommandItem>
              {accounts?.map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.name}
                  onSelect={() => handleSelect(account.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {account.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
