import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { LogPanel } from "../LogPanel";

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function AppLayout({ children, currentPage, onNavigate }: AppLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-bg-base text-text-primary overflow-hidden">
      <TitleBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

        <main className="flex-1 min-w-0 bg-bg-base flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
          <LogPanel />
        </main>
      </div>

      <StatusBar mountedCount={0} networkStatus="offline" />
    </div>
  );
}
