"use client";

import styles from "./resources.module.css";

export function ResourceNotice({ message }: { message?: string }) {
  return message ? <div className={styles.notice} role="status">{message}</div> : null;
}
