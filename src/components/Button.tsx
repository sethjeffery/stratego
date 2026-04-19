import clsx from "clsx";

import styles from "./Button.module.css";

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={clsx(styles.button, styles[variant], className)} {...rest}>
      {children}
    </button>
  );
}
