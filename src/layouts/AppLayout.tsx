import { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
  error: string | null;
};

export function AppLayout({ children, error }: AppLayoutProps) {
  return (
    <div className="app-shell">
      {children}
      {error && <div className="error card">{error}</div>}
    </div>
  );
}
