import { ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
  error: string | null;
  mode?: "default" | "game";
};

export function AppLayout({
  children,
  error,
  mode = "default",
}: AppLayoutProps) {
  return (
    <div className={`app-shell ${mode === "game" ? "app-shell-game" : ""}`}>
      {children}
      {error && <div className="error card">{error}</div>}
    </div>
  );
}
