"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePlanVersion, type DeleteResult } from "./actions";
import styles from "./plans.module.css";

// Published deletes are guarded by a native confirm (window.confirm, matching the
// Entity delete precedent — no dialog component). Drafts delete on a single click.
const PUBLISHED_CONFIRM =
  "This plan is published. Deleting it removes the plan, its inputs, and its results. This can't be undone.";

export default function PlanRowActions({
  planVersionId,
  status,
}: {
  planVersionId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    if (status === "Published" && !window.confirm(PUBLISHED_CONFIRM)) return;
    setError(null);
    startTransition(async () => {
      const result: DeleteResult = await deletePlanVersion(planVersionId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <span className={styles.actionGroup}>
      {/* Glyph in a titled span so the tooltip shows (Entity precedent). */}
      <span className={styles.btnWrap} title="Delete">
        <button
          type="button"
          className={styles.deleteGlyph}
          onClick={onDelete}
          disabled={pending}
          aria-label="Delete"
        >
          ✕
        </button>
      </span>
      {error && <span className={styles.error}>{error}</span>}
    </span>
  );
}
