import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import PendingPage from "@/pages/pending";
import RejectedPage from "@/pages/rejected";
import DashboardPage from "@/pages/dashboard";
import PagesPage from "@/pages/pages";
import InboxPage from "@/pages/inbox";
import LeadsPage from "@/pages/leads";
import AutomationPage from "@/pages/automation";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--sidebar))" }}>
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  if (user?.organizationStatus === "pending") {
    return <PendingPage />;
  }

  if (user?.organizationStatus === "rejected") {
    return <RejectedPage />;
  }

  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated || !user?.isPlatformAdmin) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/auth">
        {isLoading ? null : isAuthenticated ? <Redirect to="/dashboard" /> : <AuthPage />}
      </Route>
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/pages" component={() => <ProtectedRoute component={PagesPage} />} />
      <Route path="/inbox" component={() => <ProtectedRoute component={InboxPage} />} />
      <Route path="/leads" component={() => <ProtectedRoute component={LeadsPage} />} />
      <Route path="/automation" component={() => <ProtectedRoute component={AutomationPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/admin" component={() => <AdminRoute component={AdminPage} />} />
      <Route path="/">
        {isLoading ? null : isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/auth" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
