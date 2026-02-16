import { useState } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [currentPage, setCurrentPage] = useState("dashboard");

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-base text-text-primary overflow-hidden">
      <TitleBar />

      <div className="flex flex-1 min-h-0">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

        <main className="flex-1 min-w-0 bg-bg-base">
          {children}
        </main>
      </div>

      <StatusBar mountedCount={0} networkStatus="offline" />
    </div>
  );
}
