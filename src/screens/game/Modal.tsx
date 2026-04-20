import type { ReactNode } from "react";

import { createPortal } from "react-dom";

import { Sunburst } from "../Sunburst";
import styles from "./Modal.module.css";

export function Modal({
  actions,
  children,
  description,
  preChildren,
  sunburst,
  title,
  titleText,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  description?: string;
  preChildren?: ReactNode;
  sunburst?: boolean;
  title?: ReactNode;
  titleText?: string;
}) {
  const resolvedTitleText = typeof title === "string" ? title : titleText;
  const content = (
    <div className={styles.modalBackdrop} role="presentation">
      {preChildren}
      {sunburst ? <Sunburst /> : null}
      <section aria-modal="true" className={styles.modal} role="dialog">
        {title ? <h2 title={resolvedTitleText}>{title}</h2> : null}
        {description ? <p>{description}</p> : null}
        {children}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </section>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}
