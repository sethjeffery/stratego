import clsx from "clsx";

import styles from "./Avatar.module.css";

type AvatarProps = {
  alt?: string;
  avatarUrl?: string;
  className?: string;
  title?: string;
  color?: "red" | "blue";
  pulsing?: boolean;
  shadow?: boolean;
  onClick?: () => void;
  width?: number;
};

export default function Avatar({
  alt = "Avatar",
  avatarUrl,
  className,
  color,
  pulsing,
  shadow,
  title,
  onClick,
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
        type="button"
        className={clsx(
          wrapperClassName,
          shadow && styles.shadow,
          empty && styles.empty,
        )}
        onClick={onClick}
        title={title}
        aria-label={title ?? alt}
      >
        {empty ? (
          <span style={{ width, fontSize }} className={styles.avatar}>
            ?
          </span>
        ) : (
          <img width={width} className={styles.avatar} src={avatarUrl} alt={alt} />
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
        <span style={{ width, fontSize }} className={styles.avatar}>
          ?
        </span>
      ) : (
        <img width={width} className={styles.avatar} src={avatarUrl} alt={alt} />
      )}
    </div>
  );
}
