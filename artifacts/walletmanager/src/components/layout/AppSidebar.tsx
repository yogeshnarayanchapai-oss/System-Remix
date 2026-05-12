import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet as WalletIcon, 
  Users, 
  Scale,
  BarChart3,
  LogOut,
  Menu,
  X,
  PiggyBank,
  Database,
  Settings as SettingsIcon
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalSensitiveToggle } from './GlobalSensitiveToggle';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'EDITOR'] },
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight, roles: ['ADMIN', 'EDITOR'] },
  { path: '/wallets', label: 'Wallet Accounts', icon: WalletIcon, roles: ['ADMIN', 'EDITOR'] },
  { path: '/parties', label: 'Parties', icon: Users, roles: ['ADMIN', 'EDITOR'] },
  { path: '/receivable-payable', label: 'Receivable/Payable', icon: Scale, roles: ['ADMIN', 'EDITOR'] },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'EDITOR'] },
];

const networthItems = [
  { path: '/networth', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/networth/database', label: 'Database', icon: Database },
  { path: '/networth/settings', label: 'Settings', icon: SettingsIcon },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);

  // Filter nav items based on role
  const visibleNavItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground transition-transform duration-200",
        "md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo and Global Toggle */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
            <div className="flex items-center gap-3">
              <WalletIcon className="h-7 w-7 text-sidebar-primary" />
              <span className="text-lg font-semibold">Wallet Manager</span>
            </div>
            <GlobalSensitiveToggle />
          </div>


          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 px-3 py-4">
            {roleLoading ? (
              [...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full mb-1" />
              ))
            ) : (
              <>
                {visibleNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}

                {role === 'ADMIN' && (
                  <div className="pt-4">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                      <PiggyBank className="h-4 w-4" />
                      Net Worth
                    </div>
                    {networthItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 ml-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="mb-3 px-3">
              <p className="text-xs text-sidebar-foreground/50">Signed in as</p>
              <p className="truncate text-sm font-medium">{user?.email}</p>
              {role && (
                <p className="text-xs text-sidebar-foreground/50 mt-1">Role: {role}</p>
              )}
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
