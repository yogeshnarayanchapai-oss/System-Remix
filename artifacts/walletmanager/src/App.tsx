import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { SensitiveDataProvider } from "@/contexts/SensitiveDataContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import WalletAccounts from "./pages/WalletAccounts";
import Parties from "./pages/Parties";
import ReceivablePayable from "./pages/ReceivablePayable";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";
import Live from "./pages/Live";
import AccessLogs from "./pages/AccessLogs";
import UserLogin from "./pages/UserLogin";
import UserDashboard from "./pages/UserDashboard";
import NotFound from "./pages/NotFound";
import NetworthDashboard from "./pages/networth/NetworthDashboard";
import NetworthDatabase from "./pages/networth/NetworthDatabase";
import NetworthSettings from "./pages/networth/NetworthSettings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/live" element={<Live />} />
      <Route path="/userlogin" element={<UserLogin />} />
      <Route path="/userdashboard" element={<UserDashboard />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/wallets" element={<ProtectedRoute><WalletAccounts /></ProtectedRoute>} />
      <Route path="/paypal" element={<Navigate to="/wallets" replace />} />
      <Route path="/transfers" element={<Navigate to="/transactions" replace />} />
      <Route path="/parties" element={<ProtectedRoute><Parties /></ProtectedRoute>} />
      <Route path="/receivable-payable" element={<ProtectedRoute><ReceivablePayable /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/logs" element={<ProtectedRoute><AdminRoute><AccessLogs /></AdminRoute></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><AdminRoute><UserManagement /></AdminRoute></ProtectedRoute>} />
      <Route path="/networth" element={<ProtectedRoute><AdminRoute><NetworthDashboard /></AdminRoute></ProtectedRoute>} />
      <Route path="/networth/database" element={<ProtectedRoute><AdminRoute><NetworthDatabase /></AdminRoute></ProtectedRoute>} />
      <Route path="/networth/settings" element={<ProtectedRoute><AdminRoute><NetworthSettings /></AdminRoute></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <SensitiveDataProvider>
            <AppRoutes />
          </SensitiveDataProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
