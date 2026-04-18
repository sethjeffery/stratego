import clsx from "clsx";

import styles from "./Avatar.module.css";

type AvatarProps = {
  alt?: string;
  avatarUrl: string;
  className?: string;
  title?: string;
  color?: "red" | "blue";
  pulsing?: boolean;
  onClick?: () => void;
};

export default function Avatar({
  alt = "Avatar",
  avatarUrl,
  className,
  color,
  pulsing,
  title,
  onClick,
}: AvatarProps) {
  const wrapperClassName = clsx(
    className,
    styles.avatarWrapper,
    onClick && styles.clickable,
    color && styles[color],
    pulsing && styles.pulsing,
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={wrapperClassName}
        onClick={onClick}
        title={title}
        aria-label={title ?? alt}
      >
        <img className={styles.avatar} src={avatarUrl} alt={alt} />
      </button>
    );
  }

  return (
    <div className={wrapperClassName} title={title}>
      <img className={styles.avatar} src={avatarUrl} alt={alt} />
    </div>
  );
}
