import clsx from "clsx";
import type { ReactNode } from "react";

import styles from "./IconButton.module.css";

export function IconButton({
  className,
  children,
  ...rest
}: {
  className?: string;
  children?: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={clsx(styles.iconButton, className)} {...rest}>
      {children}
    </button>
  );
}
