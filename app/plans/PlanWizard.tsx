"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Digits-only, caret-preserving sanitizer — restores the cursor after sanitizing
// (matches RevenueStep). Prevents the caret jumping on multi-digit entry.
function handleDigits(
  e: ChangeEvent<HTMLInputElement>,
  maxLen: number,
  commit: (v: string) => void,
) {
  const el = e.target;
  const raw = el.value;
  const caret = el.selectionStart ?? raw.length;
  const removedBeforeCaret =
    raw.slice(0, caret).length - raw.slice(0, caret).replace(/\D/g, "").length;
  const clean = raw.replace(/\D/g, "").slice(0, maxLen);
  commit(clean);
  const pos = Math.max(0, caret - removedBeforeCaret);
  requestAnimationFrame(() => {
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  });
}

// Per-fork allocation (rule A): canonical option order; first N−1 fields editable,
// the LAST is a read-only derived remainder = 100 − sum(others). A fork is valid
// unless that remainder goes negative (others already exceed 100).
function forkParts(
  options: readonly string[],
  selected: string[],
  alloc: Record<string, string>,
) {
  const ordered = options.filter((o) => selected.includes(o)); // canonical order
  const editable = ordered.slice(0, -1);
  const last = ordered[ordered.length - 1];
  const derived = 100 - editable.reduce((n, f) => n + (Number(alloc[f]) || 0), 0);
  return { ordered, editable, last, derived };
}

// Allocation sub-UI for a fork (shown only when >1 selected). MODULE-LEVEL (stable
// component identity) so it does NOT remount on every keystroke — that remount, from
// defining this inside the render, was the caret/focus-loss bug.
function AllocBlock({
  label,
  options,
  selected,
  alloc,
  setAlloc,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  alloc: Record<string, string>;
  setAlloc: (updater: (a: Record<string, string>) => Record<string, string>) => void;
}) {
  const { editable, last, derived } = forkParts(options, selected, alloc);
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
      {editable.map((f) => {
        const raw = alloc[f] ?? "";
        const isZero = raw !== "" && Number(raw) === 0; // SOFT: explicit 0
        return (
          <div key={f} className={styles.allocField}>
            <label className={styles.allocRow}>
              <span>{f}</span>
              {/* Plain integer entry (no spinners) with a % affordance. */}
              <span className={styles.pctField}>
                <input
                  className={styles.pctInput}
                  type="text"
                  inputMode="numeric"
                  value={raw}
                  onChange={(e) =>
                    handleDigits(e, 3, (v) => setAlloc((a) => ({ ...a, [f]: v })))
                  }
                  aria-label={`${f} allocation percent`}
                />
                <span className={styles.pctSuffix}>%</span>
              </span>
            </label>
            {isZero && (
              <span className={styles.warnSoft}>
                0% — deselect this option instead?
              </span>
            )}
          </div>
        );
      })}
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
          Total exceeds 100% — reduce the other fields to free up the remainder.
        </span>
      )}
    </div>
  );
}

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

  // Start month is stored as "YYYY-MM"; split for the Month + Year controls. Month
  // is always 2 digits (from the select), so this stays robust while the year is typed.
  const [startYear, startMon] = startMonth.split("-");
  const setStartMon = (m: string) => setStartMonth(`${startYear}-${m}`);
  const setStartYear = (y: string) => setStartMonth(`${y}-${startMon}`);

  // ── Step 2 client validation (mirrors the server gate) ──────────────────────
  const startIsJan = startMon === "01";
  const x = Number(horizonX);
  const horizonValid =
    Number.isInteger(x) && x >= HORIZON_MIN && x <= HORIZON_MAX;
  const horizonFullYearErr = !startIsJan && x === 0;

  const whNeedsAlloc = warehouse.length > 1;
  const dlNeedsAlloc = delivery.length > 1;
  const whAllocOk = !whNeedsAlloc || forkParts(WAREHOUSE, warehouse, alloc).derived >= 0;
  const dlAllocOk = !dlNeedsAlloc || forkParts(DELIVERY, delivery, alloc).derived >= 0;

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
      const { editable, last, derived } = forkParts(options, selected, alloc);
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
          <div className={styles.field}>
            <span className={styles.label}>Start month</span>
            <div className={styles.row}>
              <select
                className={styles.input}
                value={startMon}
                onChange={(e) => setStartMon(e.target.value)}
                aria-label="Start month"
              >
                {MONTHS.map((label, i) => {
                  const v = String(i + 1).padStart(2, "0");
                  return (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <input
                className={`${styles.input} ${styles.smallInput}`}
                type="text"
                inputMode="numeric"
                value={startYear}
                onChange={(e) =>
                  setStartYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                aria-label="Start year"
                placeholder="YYYY"
              />
            </div>
          </div>
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
            {whNeedsAlloc && (
              <AllocBlock label="Warehouse Operations" options={WAREHOUSE} selected={warehouse} alloc={alloc} setAlloc={setAlloc} />
            )}
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
            {dlNeedsAlloc && (
              <AllocBlock label="Delivery Options" options={DELIVERY} selected={delivery} alloc={alloc} setAlloc={setAlloc} />
            )}
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
