import { cn } from '@/lib/utils';

type StatusVariant = 'active' | 'inactive' | 'incoming' | 'outgoing' | 'receivable' | 'payable' | 'settled';

interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<StatusVariant, string> = {
  active: 'badge-active',
  inactive: 'badge-inactive',
  incoming: 'badge-incoming',
  outgoing: 'badge-outgoing',
  receivable: 'badge-receivable',
  payable: 'badge-payable',
  settled: 'bg-muted text-muted-foreground border border-border',
};

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}
