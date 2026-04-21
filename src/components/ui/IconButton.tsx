import type { ReactNode } from "react";

import clsx from "clsx";

import styles from "./IconButton.module.css";

export function IconButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button className={clsx(styles.iconButton, className)} {...rest}>
      {children}
    </button>
  );
}
