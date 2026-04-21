import clsx from "clsx";

import styles from "./Avatar.module.css";

type AvatarProps = {
  alt?: string;
  avatarUrl?: string;
  className?: string;
  color?: "blue" | "red";
  onClick?: () => void;
  pulsing?: boolean;
  shadow?: boolean;
  title?: string;
  width?: number;
};

export default function Avatar({
  alt = "Avatar",
  avatarUrl,
  className,
  color,
  onClick,
  pulsing,
  shadow,
  title,
  width,
}: AvatarProps) {
  const wrapperClassName = clsx(
    className,
    styles.avatarWrapper,
    onClick && styles.clickable,
    color && styles[color],
    pulsing && styles.pulsing,
  );

  const fontSize = width && width * 0.33;
  const empty = !avatarUrl;

  if (onClick) {
    return (
      <button
        aria-label={title ?? alt}
        className={clsx(
          wrapperClassName,
          shadow && styles.shadow,
          empty && styles.empty,
        )}
        onClick={onClick}
        title={title}
        type="button"
      >
        {empty ? (
          <span className={styles.avatar} style={{ fontSize, width }}>
            ?
          </span>
        ) : (
          <img alt={alt} className={styles.avatar} src={avatarUrl} width={width} />
        )}
      </button>
    );
  }

  return (
    <div
      className={clsx(wrapperClassName, shadow && styles.shadow, empty && styles.empty)}
      title={title}
    >
      {empty ? (
        <span className={styles.avatar} style={{ fontSize, width }}>
          ?
        </span>
      ) : (
        <img alt={alt} className={styles.avatar} src={avatarUrl} width={width} />
      )}
    </div>
  );
}
