import clsx from "clsx";
import type { ReactNode } from "react";

import styles from "./AppLayout.module.css";

type AppLayoutProps = {
  children: ReactNode;
  mode?: "default" | "game";
};

export function AppLayout({ children }: AppLayoutProps) {
  return <div className={clsx(styles.appShell)}>{children}</div>;
}
