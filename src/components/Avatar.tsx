import styles from "./Avatar.module.css";
import clsx from "clsx";

export default function Avatar({
  alt = "Avatar",
  avatarUrl,
  className,
  color,
  pulsing,
  title,
  onClick,
}: {
  alt?: string;
  avatarUrl: string;
  className?: string;
  title?: string;
  color?: "red" | "blue";
  pulsing?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={clsx(
        className,
        styles.avatarWrapper,
        onClick && styles.clickable,
        color && styles[color],
        pulsing && styles.pulsing,
      )}
      onClick={onClick}
      title={title}
    >
      <img className={styles.avatar} src={avatarUrl} alt={alt} />
    </div>
  );
}
