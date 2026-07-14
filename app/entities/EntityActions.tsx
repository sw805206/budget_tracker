"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveEntity, unarchiveEntity, deleteEntity } from "./actions";
import type { ActionResult } from "./actions";
import styles from "./entities.module.css";

const REFERENCED_TITLE =
  "Referenced by plan data — archive instead; a referenced entity can't be hard-deleted.";
const UNUSED_ARCHIVE_TITLE =
  "Not used by any plan — nothing to preserve. Delete it instead.";

// One button, always wrapped in a titled span so the tooltip shows even when the
// button is disabled (browsers suppress title/hover on disabled controls).
function ActionButton({
  label,
  title,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <span className={styles.btnWrap} title={title}>
      <button
        type="button"
        className={danger ? styles.dangerBtn : styles.actionBtn}
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </button>
    </span>
  );
}

export default function EntityActions({
  id,
  archived,
  isReferenced,
}: {
  id: string;
  archived: boolean;
  isReferenced: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>, onOk: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onOk();
      else setError(result.error);
    });
  }

  const onArchive = () => run(() => archiveEntity(id), () => router.refresh());
  const onUnarchive = () =>
    run(() => unarchiveEntity(id), () => router.refresh());
  const onDelete = () => {
    if (
      !window.confirm(
        "Delete this entity permanently? This is irreversible and cannot be undone.",
      )
    )
      return;
    run(() => deleteEntity(id), () => {
      router.push("/entities");
      router.refresh();
    });
  };

  return (
    <span className={styles.actionGroup}>
      {/* Archive — Active tab only; greyed when unused (nothing to preserve). */}
      {!archived && (
        <ActionButton
          label="Archive"
          title={
            isReferenced
              ? "Archive — hide from Active. Plan data is untouched."
              : UNUSED_ARCHIVE_TITLE
          }
          onClick={onArchive}
          disabled={pending || !isReferenced}
        />
      )}

      {/* Unarchive — Archived tab only; always enabled. */}
      {archived && (
        <ActionButton
          label="Unarchive"
          title="Unarchive — move back to Active."
          onClick={onUnarchive}
          disabled={pending}
        />
      )}

      {/* Delete — both tabs; greyed whenever referenced. */}
      <ActionButton
        label="Delete"
        title={
          isReferenced
            ? REFERENCED_TITLE
            : "Delete permanently — this entity is unreferenced."
        }
        onClick={onDelete}
        disabled={pending || isReferenced}
        danger
      />

      {error && <span className={styles.error}>{error}</span>}
    </span>
  );
}
