import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Users,
  Zap,
  BarChart2,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pages", label: "Pages", icon: FileText },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-56 flex flex-col" style={{ background: "hsl(var(--sidebar))", borderRight: "1px solid hsl(var(--sidebar-border))" }}>
      <div className="flex items-center gap-2.5 px-5 h-14 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ background: "hsl(var(--sidebar-primary))" }}>SB</div>
        <span className="font-semibold text-sm" style={{ color: "hsl(var(--sidebar-foreground))" }}>SocialBoxx</span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <a
                data-testid={`nav-${label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 group",
                  active
                    ? "text-white"
                    : "hover:bg-white/5"
                )}
                style={{
                  color: active ? "hsl(var(--sidebar-primary-foreground))" : "hsl(var(--sidebar-foreground) / 0.7)",
                  background: active ? "hsl(var(--sidebar-primary))" : undefined,
                }}
              >
                <Icon size={15} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={12} className="opacity-60" />}
              </a>
            </Link>
          );
        })}

        {user?.isPlatformAdmin && (
          <Link href="/admin">
            <a
              data-testid="nav-admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
                location.startsWith("/admin") ? "text-white" : "hover:bg-white/5"
              )}
              style={{
                color: location.startsWith("/admin") ? "hsl(var(--sidebar-primary-foreground))" : "hsl(var(--sidebar-foreground) / 0.7)",
                background: location.startsWith("/admin") ? "hsl(var(--sidebar-primary))" : undefined,
              }}
            >
              <Shield size={15} className="shrink-0" />
              <span className="flex-1">Admin</span>
            </a>
          </Link>
        )}
      </nav>

      <div className="px-3 py-3 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md" style={{ background: "hsl(var(--sidebar-accent))" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "hsl(var(--sidebar-primary))", color: "hsl(var(--sidebar-primary-foreground))" }}>
            {user?.fullName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "hsl(var(--sidebar-foreground))" }}>{user?.fullName ?? user?.email}</p>
            <p className="text-xs truncate capitalize" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>{user?.role}</p>
          </div>
          <button
            data-testid="button-logout"
            onClick={logout}
            className="p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: "hsl(var(--sidebar-foreground))" }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
