import clsx from "clsx";
import { ReactNode } from "react";
import styles from "./AppLayout.module.css";

type AppLayoutProps = {
  children: ReactNode;
  error: string | null;
  mode?: "default" | "game";
};

export function AppLayout({ children, error, mode = "default" }: AppLayoutProps) {
  return (
    <div className={clsx(styles.appShell, mode === "game" && styles.gameMode)}>
      {children}
      {error && <div className={clsx("card", styles.error)}>{error}</div>}
    </div>
  );
}
