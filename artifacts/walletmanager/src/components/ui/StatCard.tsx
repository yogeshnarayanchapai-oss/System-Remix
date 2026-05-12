import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: 'default' | 'primary';
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  variant = 'default',
  trend,
  className 
}: StatCardProps) {
  return (
    <div className={cn(
      variant === 'primary' ? 'stat-card-primary' : 'stat-card',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn(
            'text-sm font-medium',
            variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}>
            {title}
          </p>
          <p className={cn(
            'mt-2 text-2xl font-bold tracking-tight',
            variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'
          )}>
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              'mt-1 text-sm',
              variant === 'primary' ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={cn(
              'mt-2 text-sm',
              trend.value > 0 ? 'text-success' : trend.value < 0 ? 'text-payable' : 'text-muted-foreground'
            )}>
              {trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            'rounded-lg p-2',
            variant === 'primary' ? 'bg-primary-foreground/10' : 'bg-primary/10'
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
