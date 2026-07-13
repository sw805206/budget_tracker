"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ENTITY_TYPES,
  PAYMENT_FLOWS,
  PAYMENT_TERM_ANCHORS,
  PAYMENT_TERM_DEFAULT,
} from "./constants";
import { createEntity, updateEntity, type EntityInput } from "./actions";
import styles from "./entities.module.css";

type ExistingName = { id: string; name: string | null };

type InitialEntity = {
  id: string;
  name: string | null;
  type: string | null;
  paymentFlow: string | null;
  paymentTermAnchor: string | null;
  paymentTermDays: number | null;
  tags: string | null;
  comments: string | null;
};

type Props =
  | { mode: "create"; existingNames: ExistingName[]; initial?: undefined }
  | { mode: "edit"; existingNames: ExistingName[]; initial: InitialEntity };

// Blank create-form state, prefilled with the Ph1 defaults.
function blankForm(): EntityInput {
  return {
    name: "",
    type: "",
    paymentFlow: "",
    paymentTermAnchor: PAYMENT_TERM_DEFAULT.anchor,
    paymentTermDays: String(PAYMENT_TERM_DEFAULT.days),
    tags: "",
    comments: "",
  };
}

function fromInitial(e: InitialEntity): EntityInput {
  return {
    name: e.name ?? "",
    type: e.type ?? "",
    paymentFlow: e.paymentFlow ?? "",
    paymentTermAnchor: e.paymentTermAnchor ?? PAYMENT_TERM_DEFAULT.anchor,
    paymentTermDays:
      e.paymentTermDays == null ? "" : String(e.paymentTermDays),
    tags: e.tags ?? "",
    comments: e.comments ?? "",
  };
}

export default function EntityForm(props: Props) {
  const { mode, existingNames } = props;
  const router = useRouter();
  const [form, setForm] = useState<EntityInput>(
    mode === "edit" ? fromInitial(props.initial) : blankForm(),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const set = (patch: Partial<EntityInput>) =>
    setForm((f) => ({ ...f, ...patch }));

  // Mandatory-field state (for inline hints). Mirrors the server gate.
  const missing = {
    name: !form.name.trim(),
    type: !form.type,
    paymentFlow: !form.paymentFlow,
    paymentTermAnchor: !form.paymentTermAnchor,
    paymentTermDays:
      form.paymentTermDays === "" ||
      !Number.isInteger(Number(form.paymentTermDays)) ||
      Number(form.paymentTermDays) < 0,
  };
  const hasMissing = Object.values(missing).some(Boolean);

  // Non-blocking duplicate-name warning (case-insensitive; excludes self on edit).
  const duplicate = useMemo(() => {
    const name = form.name.trim().toLowerCase();
    if (!name) return false;
    const selfId = mode === "edit" ? props.initial.id : undefined;
    return existingNames.some(
      (e) =>
        e.id !== selfId && (e.name ?? "").trim().toLowerCase() === name,
    );
  }, [form.name, existingNames, mode, props]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasMissing) {
      setShowErrors(true);
      setError("All required fields must be completed before saving.");
      return;
    }
    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updateEntity(props.initial.id, form)
          : await createEntity(form);
      if (result.ok) {
        router.push(`/entities/${result.id}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const err = (show: boolean) =>
    showErrors && show ? styles.fieldError : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/entities">← All entities</Link>
      </div>
      <h1 className={styles.h1}>
        {mode === "edit" ? "Edit entity" : "New entity"}
      </h1>

      <form onSubmit={onSubmit} className={styles.form} noValidate>
        {/* Name */}
        <label className={styles.field}>
          <span className={styles.label}>
            Name <span className={styles.req}>*</span>
          </span>
          <input
            className={`${styles.input} ${err(missing.name) ?? ""}`}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Entity name"
          />
          {duplicate && (
            <span className={styles.warn}>
              ⚠ An entity with this name already exists. You can still save.
            </span>
          )}
        </label>

        {/* Type */}
        <label className={styles.field}>
          <span className={styles.label}>
            Type <span className={styles.req}>*</span>
          </span>
          <select
            className={`${styles.input} ${err(missing.type) ?? ""}`}
            value={form.type}
            onChange={(e) => set({ type: e.target.value })}
          >
            <option value="">Select type…</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {/* Payment Flow */}
        <label className={styles.field}>
          <span className={styles.label}>
            Payment Flow <span className={styles.req}>*</span>
          </span>
          <select
            className={`${styles.input} ${err(missing.paymentFlow) ?? ""}`}
            value={form.paymentFlow}
            onChange={(e) => set({ paymentFlow: e.target.value })}
          >
            <option value="">Select flow…</option>
            {PAYMENT_FLOWS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        {/* Payment Term: anchor + days */}
        <div className={styles.field}>
          <span className={styles.label}>
            Payment Term <span className={styles.req}>*</span>
          </span>
          <div className={styles.row}>
            <select
              className={`${styles.input} ${err(missing.paymentTermAnchor) ?? ""}`}
              value={form.paymentTermAnchor}
              onChange={(e) => set({ paymentTermAnchor: e.target.value })}
              aria-label="Payment term anchor"
            >
              <option value="">Select anchor…</option>
              {PAYMENT_TERM_ANCHORS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className={styles.plus}>+</span>
            <input
              className={`${styles.input} ${styles.daysInput} ${err(missing.paymentTermDays) ?? ""}`}
              type="number"
              min={0}
              step={1}
              value={form.paymentTermDays}
              onChange={(e) => set({ paymentTermDays: e.target.value })}
              aria-label="Payment term days"
            />
            <span className={styles.suffix}>days</span>
          </div>
        </div>

        {/* Tags */}
        <label className={styles.field}>
          <span className={styles.label}>Tags</span>
          <input
            className={styles.input}
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
            placeholder="Freeform, e.g. comma-separated"
          />
        </label>

        {/* Comments */}
        <label className={styles.field}>
          <span className={styles.label}>Comments</span>
          <textarea
            className={styles.input}
            rows={3}
            value={form.comments}
            onChange={(e) => set({ comments: e.target.value })}
          />
        </label>

        <p className={styles.note}>
          Currency is set automatically for Phase 1 and isn&apos;t editable here.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primary}
            disabled={pending}
          >
            {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create entity"}
          </button>
          <Link href="/entities" className={styles.secondary}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
