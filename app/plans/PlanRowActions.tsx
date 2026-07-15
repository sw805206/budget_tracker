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

  // Resume is Draft-only (BL-019). Published rows render NO resume glyph at all — not a
  // disabled one — since a Published version is immutable.
  const isDraft = status === "Draft";

  const onResume = () => router.push(`/plans/resume/${planVersionId}`);

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
      {/* Resume — first position, Draft only. Glyph in a titled span (hover label). */}
      {isDraft && (
        <span className={styles.btnWrap} title="Resume">
          <button
            type="button"
            className={`${styles.rowGlyph} ${styles.resumeGlyph}`}
            onClick={onResume}
            aria-label="Resume"
          >
            ↺
          </button>
        </span>
      )}
      {/* Delete — always last/rightmost. */}
      <span className={styles.btnWrap} title="Delete">
        <button
          type="button"
          className={`${styles.rowGlyph} ${styles.deleteGlyph}`}
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
