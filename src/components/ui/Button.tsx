import clsx from "clsx";

import styles from "./Button.module.css";

export function Button({
  children,
  className,
  variant = "primary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <button className={clsx(styles.button, styles[variant], className)} {...rest}>
      {children}
    </button>
  );
}
