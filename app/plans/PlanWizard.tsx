"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PLAN_FORKS,
  STEP_WAREHOUSE,
  STEP_DELIVERY,
  HORIZON_DEFAULT,
  HORIZON_MIN,
  HORIZON_MAX,
  type TargetCashMode,
} from "./constants";
import {
  createDraftPlan,
  updatePlanMeta,
  savePlanParameters,
} from "./actions";
import styles from "./plans.module.css";

const STEP_LABELS = [
  "Planning Version",
  "Planning Parameters",
  "Planning Assumptions",
  "Results",
];

const WAREHOUSE = PLAN_FORKS[0].options;
const DELIVERY = PLAN_FORKS[1].options;

export default function PlanWizard({
  defaultName,
  defaultStartMonth,
}: {
  defaultName: string;
  defaultStartMonth: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [planVersionId, setPlanVersionId] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState(defaultName);
  const [startMonth, setStartMonth] = useState(defaultStartMonth);

  // Step 2
  const [horizonX, setHorizonX] = useState(String(HORIZON_DEFAULT));
  const [warehouse, setWarehouse] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<string[]>([]);
  const [beginningCash, setBeginningCash] = useState("0");
  const [targetCashValue, setTargetCashValue] = useState("0");
  const [targetCashMode, setTargetCashMode] = useState<TargetCashMode>("dollars");
  const [alloc, setAlloc] = useState<Record<string, string>>({}); // flow -> percent string

  const toggle = (list: string[], set: (v: string[]) => void, opt: string) =>
    set(list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt]);

  // ── Step 2 client validation (mirrors the server gate) ──────────────────────
  const startIsJan = startMonth.slice(5, 7) === "01";
  const x = Number(horizonX);
  const horizonValid =
    Number.isInteger(x) && x >= HORIZON_MIN && x <= HORIZON_MAX;
  const horizonFullYearErr = !startIsJan && x === 0;

  // Per-fork allocation (rule A): canonical option order; first N−1 fields editable,
  // the LAST is a read-only derived remainder = 100 − sum(others). A fork is valid
  // unless that remainder goes negative (others already exceed 100).
  const sumOf = (flows: string[]) =>
    flows.reduce((n, f) => n + (Number(alloc[f]) || 0), 0);
  const forkParts = (options: readonly string[], selected: string[]) => {
    const ordered = options.filter((o) => selected.includes(o)); // canonical order
    const editable = ordered.slice(0, -1);
    const last = ordered[ordered.length - 1];
    const derived = 100 - sumOf(editable);
    return { ordered, editable, last, derived };
  };
  const whNeedsAlloc = warehouse.length > 1;
  const dlNeedsAlloc = delivery.length > 1;
  const whAllocOk = !whNeedsAlloc || forkParts(WAREHOUSE, warehouse).derived >= 0;
  const dlAllocOk = !dlNeedsAlloc || forkParts(DELIVERY, delivery).derived >= 0;

  const step2Ok =
    horizonValid &&
    !horizonFullYearErr &&
    warehouse.length >= 1 &&
    delivery.length >= 1 &&
    whAllocOk &&
    dlAllocOk;

  // ── Actions ─────────────────────────────────────────────────────────────────
  function submitStep1() {
    setError(null);
    if (!name.trim()) return setError("File name is required.");
    startTransition(async () => {
      if (planVersionId) {
        const res = await updatePlanMeta(planVersionId, { name, startMonth });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      } else {
        const res = await createDraftPlan({ name, startMonth });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setPlanVersionId(res.planVersionId);
      }
      setStep(2);
    });
  }

  function submitStep2() {
    setError(null);
    if (!planVersionId) return setError("Create the plan in Step 1 first.");
    if (!step2Ok) return setError("Fix the highlighted fields before continuing.");
    // Canonical-ordered rows; the derived last value is written like any other row.
    const allocRows = (options: readonly string[], selected: string[]) => {
      const { editable, last, derived } = forkParts(options, selected);
      return [
        ...editable.map((f) => ({ flow: f, percentage: Number(alloc[f]) || 0 })),
        { flow: last, percentage: derived },
      ];
    };
    startTransition(async () => {
      const res = await savePlanParameters(planVersionId, {
        horizonX: x,
        warehouseSelections: warehouse,
        deliverySelections: delivery,
        beginningCash: Number(beginningCash) || 0,
        targetCashValue: Number(targetCashValue) || 0,
        targetCashMode,
        warehouseAllocations: whNeedsAlloc ? allocRows(WAREHOUSE, warehouse) : [],
        deliveryAllocations: dlNeedsAlloc ? allocRows(DELIVERY, delivery) : [],
      });
      if (!res.ok) return setError(res.error);
      setStep(3);
    });
  }

  // ── Allocation sub-UI for a fork (shown only when >1 selected) ───────────────
  const AllocBlock = ({
    label,
    options,
    selected,
  }: {
    label: string;
    options: readonly string[];
    selected: string[];
  }) => {
    const { editable, last, derived } = forkParts(options, selected);
    const over = derived < 0;
    return (
      <div className={styles.allocBlock}>
        <div className={styles.allocHead}>
          {label} allocation %{" "}
          {over ? (
            <span className={styles.sumBad}>(over 100% by {Math.abs(derived)}%)</span>
          ) : (
            <span className={styles.sumOk}>(auto-balances to 100%)</span>
          )}
        </div>
        {editable.map((f) => (
          <label key={f} className={styles.allocRow}>
            <span>{f}</span>
            <input
              className={styles.smallInput}
              type="number"
              min={0}
              max={100}
              value={alloc[f] ?? ""}
              onChange={(e) => setAlloc((a) => ({ ...a, [f]: e.target.value }))}
            />
          </label>
        ))}
        {/* Last selected flow (canonical order) — read-only derived remainder. */}
        <label className={styles.allocRow}>
          <span>
            {last} <span className={styles.derivedTag}>auto</span>
          </span>
          <input
            className={`${styles.smallInput} ${styles.derivedInput} ${over ? styles.fieldError : ""}`}
            type="number"
            value={derived}
            readOnly
            aria-label={`${last} — auto-calculated remainder`}
          />
        </label>
        {over && (
          <span className={styles.warn}>
            Allocation exceeds 100% — reduce the other fields.
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/plans">← All plans</Link>
      </div>
      <h1 className={styles.h1}>New plan — WF-001 (Create New)</h1>

      {/* Step indicator */}
      <ol className={styles.steps}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const cls =
            n === step ? styles.stepCurrent : n < step ? styles.stepDone : styles.stepTodo;
          return (
            <li key={label} className={cls}>
              <span className={styles.stepNum}>{n}</span> {label}
            </li>
          );
        })}
      </ol>

      {error && <p className={styles.error}>{error}</p>}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>File name</span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Start month</span>
            <input
              className={styles.input}
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={submitStep1} disabled={pending}>
              {pending ? "Saving…" : planVersionId ? "Save & Next" : "Create & Next"}
            </button>
            <Link href="/plans" className={styles.secondary}>Cancel</Link>
          </div>
          <p className={styles.note}>
            Creating the plan saves a Draft immediately — you can leave and finish it
            later from the Plans list.
          </p>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>
              Planning horizon (full years after CY, {HORIZON_MIN}–{HORIZON_MAX})
            </span>
            <input
              className={`${styles.input} ${styles.smallInput} ${!horizonValid || horizonFullYearErr ? styles.fieldError : ""}`}
              type="number"
              min={HORIZON_MIN}
              max={HORIZON_MAX}
              value={horizonX}
              onChange={(e) => setHorizonX(e.target.value)}
            />
            {horizonFullYearErr && (
              <span className={styles.warn}>you don&apos;t have a full year</span>
            )}
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Warehouse Operations (select ≥1)</span>
            <div className={styles.checks}>
              {WAREHOUSE.map((o) => (
                <label key={o} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={warehouse.includes(o)}
                    onChange={() => toggle(warehouse, setWarehouse, o)}
                  />
                  {o}
                </label>
              ))}
            </div>
            {whNeedsAlloc && <AllocBlock label="Warehouse Operations" options={WAREHOUSE} selected={warehouse} />}
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Delivery Options (select ≥1)</span>
            <div className={styles.checks}>
              {DELIVERY.map((o) => (
                <label key={o} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={delivery.includes(o)}
                    onChange={() => toggle(delivery, setDelivery, o)}
                  />
                  {o}
                </label>
              ))}
            </div>
            {dlNeedsAlloc && <AllocBlock label="Delivery Options" options={DELIVERY} selected={delivery} />}
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Beginning Cash ($)</span>
            <input
              className={`${styles.input} ${styles.smallInput}`}
              type="number"
              value={beginningCash}
              onChange={(e) => setBeginningCash(e.target.value)}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Target on-hand Cash</span>
            <div className={styles.row}>
              <input
                className={`${styles.input} ${styles.smallInput}`}
                type="number"
                value={targetCashValue}
                onChange={(e) => setTargetCashValue(e.target.value)}
              />
              <select
                className={styles.input}
                value={targetCashMode}
                onChange={(e) => setTargetCashMode(e.target.value as TargetCashMode)}
              >
                <option value="dollars">$ (dollars)</option>
                <option value="months">months of costs</option>
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.secondary} onClick={() => { setError(null); setStep(1); }} disabled={pending}>
              Back
            </button>
            <button className={styles.primary} onClick={submitStep2} disabled={pending || !step2Ok}>
              {pending ? "Saving…" : "Save & Next"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 stub ── */}
      {step === 3 && (
        <div className={styles.stub}>
          <h2 className={styles.stubTitle}>Planning Assumptions</h2>
          <p>Revenue &amp; Cost assumption tabs — coming in the next slice.</p>
          <div className={styles.actions}>
            <button className={styles.secondary} onClick={() => setStep(2)}>Back</button>
            <button className={styles.primary} onClick={() => setStep(4)}>Next</button>
          </div>
        </div>
      )}

      {/* ── STEP 4 stub ── */}
      {step === 4 && (
        <div className={styles.stub}>
          <h2 className={styles.stubTitle}>Results</h2>
          <p>P&amp;L + cashflow report — coming in the next slice.</p>
          <div className={styles.actions}>
            <button className={styles.secondary} onClick={() => setStep(3)}>Back</button>
            <Link href="/plans" className={styles.primary}>Done — back to Plans</Link>
          </div>
        </div>
      )}
    </div>
  );
}
