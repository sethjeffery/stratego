import clsx from "clsx";
import type { ReactNode } from "react";

import background from "../assets/battle-bg.webp";
import styles from "./AppLayout.module.css";

type AppLayoutProps = {
  children: ReactNode;
  mode?: "default" | "game";
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className={clsx(styles.appShell)}>
      {children}
      <img
        src={background}
        alt="Battle background"
        className={styles.backgroundImage}
      />
    </div>
  );
}
