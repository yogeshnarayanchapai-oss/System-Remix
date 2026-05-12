import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRegister } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, setToken } = useAuth();
  const registerMutation = useRegister();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
      setLocation("/dashboard");
    } catch {
      toast({ title: "Login failed", description: "Invalid email or password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await registerMutation.mutateAsync({ data: { email, password, fullName, organizationName: orgName } });
      setToken(result.token);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err?.data?.message ?? "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(var(--sidebar))" }}>
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12" style={{ background: "hsl(224 40% 8%)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "hsl(var(--sidebar-primary))" }}>SB</div>
          <span className="text-white font-semibold text-lg">SocialBoxx</span>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Manage your Facebook pages<br />
            <span style={{ color: "hsl(var(--sidebar-primary))" }}>from one command center.</span>
          </h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm">
            Conversations, leads, automation, and reports — everything your team needs to turn Facebook messages into revenue.
          </p>
        </div>
        <div className="flex gap-6">
          {[["2,400+", "Conversations managed"], ["94%", "Reply rate"], ["3x", "Lead conversion"]].map(([stat, label]) => (
            <div key={label}>
              <div className="text-2xl font-bold text-white">{stat}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
            <p className="text-sm mt-1" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>
              {mode === "login" ? "Sign in to your account" : "Get started with a free account"}
            </p>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}>Full name</Label>
                  <Input
                    data-testid="input-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="border-0 text-white placeholder:text-gray-600"
                    style={{ background: "hsl(224 40% 12%)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}>Organization name</Label>
                  <Input
                    data-testid="input-orgname"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Agency"
                    required
                    className="border-0 text-white placeholder:text-gray-600"
                    style={{ background: "hsl(224 40% 12%)" }}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}>Email</Label>
              <Input
                data-testid="input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="border-0 text-white placeholder:text-gray-600"
                style={{ background: "hsl(224 40% 12%)" }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}>Password</Label>
              <Input
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="border-0 text-white placeholder:text-gray-600"
                style={{ background: "hsl(224 40% 12%)" }}
              />
            </div>

            <Button
              data-testid="button-submit"
              type="submit"
              disabled={loading}
              className="w-full font-semibold"
              style={{ background: "hsl(var(--sidebar-primary))", color: "white" }}
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm" style={{ color: "hsl(var(--sidebar-foreground) / 0.4)" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              data-testid="button-toggle-mode"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-medium hover:underline"
              style={{ color: "hsl(var(--sidebar-primary))" }}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
