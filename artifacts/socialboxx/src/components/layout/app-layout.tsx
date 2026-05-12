import { Sidebar } from "./sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 overflow-y-auto min-h-screen" style={{ background: "hsl(var(--background))" }}>
        {children}
      </main>
    </div>
  );
}
