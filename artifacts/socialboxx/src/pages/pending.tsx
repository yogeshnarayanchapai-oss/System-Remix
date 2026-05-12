import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export default function PendingPage() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--sidebar))" }}>
      <div className="text-center space-y-6 max-w-md px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "hsl(230 100% 60% / 0.15)" }}>
          <Clock size={28} style={{ color: "hsl(var(--sidebar-primary))" }} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Awaiting Approval</h1>
          <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>
            Your organization <strong className="text-white">{user?.organizationName}</strong> has been registered and is pending review. You'll receive access once approved by an administrator.
          </p>
        </div>
        <Button
          data-testid="button-logout"
          onClick={logout}
          variant="outline"
          className="border-white/10 text-white/60 hover:text-white hover:border-white/30"
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
