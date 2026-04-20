import type { CSSProperties } from "react";

import styles from "./Sunburst.module.css";

export function Sunburst() {
  return (
    <div className={styles.sunbursts}>
      <div className={styles.sunburst} />
      <div
        className={styles.sunburst}
        style={
          {
            "--sunburst-delay": "-0.3s",
            "--sunburst-rotation": "5deg",
            "--sunburst-scale": 0.8,
            "--sunburst-speed": "1.4s",
          } as CSSProperties
        }
      />
      <div
        className={styles.sunburst}
        style={
          {
            "--sunburst-delay": "-0.4s",
            "--sunburst-rotation": "10deg",
            "--sunburst-scale": 0.65,
            "--sunburst-speed": "2.5s",
          } as CSSProperties
        }
      />
    </div>
  );
}
