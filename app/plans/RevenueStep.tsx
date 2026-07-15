"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import {
  getRevenueData,
  saveRevenue,
  createRevenueClient,
  deleteClients,
  type ClientOption,
} from "./revenue-actions";
import styles from "./plans.module.css";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const JAN_NOV = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

type Row = {
  entityId: string;
  name: string;
  revenue: Record<number, string>;
  seasonality: Record<number, string>; // months 1..11; Dec derived
};

// Digits-only, caret-preserving (restore cursor after sanitizing — do not blindly
// rewrite to end; avoids the Step-2 "2nd digit won't type" bug).
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

// Thousands separators for DISPLAY only (state stays raw — never persist the
// formatted string). Handles an optional decimal part.
function formatThousands(raw: string): string {
  if (raw === "") return "";
  const [intPart, decPart] = raw.split(".");
  const intFmt = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${intFmt}.${decPart}` : intFmt;
}

// Money field: DISPLAYS comma-formatted, STORES raw (digits + one dot; never a
// formatted string). Caret is restored in useLayoutEffect — after React re-renders
// the reformatted value — by counting significant chars (digits/dot) before the
// cursor, so commas never fight typing (append OR mid-string). Module-level = stable
// component identity (no remount; PR#12 lesson).
function MoneyInput({
  value,
  onChangeRaw,
  ariaLabel,
  className,
}: {
  value: string;
  onChangeRaw: (raw: string) => void;
  ariaLabel: string;
  className: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caretRef.current != null && ref.current) {
      const p = caretRef.current;
      ref.current.setSelectionRange(p, p);
      caretRef.current = null;
    }
  });
  return (
    <input
      ref={ref}
      className={className}
      type="text"
      inputMode="decimal"
      value={formatThousands(value)}
      aria-label={ariaLabel}
      onChange={(e) => {
        const el = e.target;
        const before = el.value;
        const caret = el.selectionStart ?? before.length;
        const sigBeforeCaret = before.slice(0, caret).replace(/[^\d.]/g, "").length;
        const raw = before.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
        const formatted = formatThousands(raw);
        let sig = 0;
        let pos = formatted.length;
        for (let i = 0; i < formatted.length; i++) {
          if (/[\d.]/.test(formatted[i])) sig++;
          if (sig >= sigBeforeCaret) {
            pos = i + 1;
            break;
          }
        }
        caretRef.current = sigBeforeCaret === 0 ? 0 : pos;
        onChangeRaw(raw);
      }}
    />
  );
}

export default function RevenueStep({
  planVersionId,
  startMonth,
  horizonX,
  onBack,
  onDone,
}: {
  planVersionId: string;
  startMonth: string;
  horizonX: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const cy = Number(startMonth.slice(0, 4));
  const startMonthNum = Number(startMonth.slice(5, 7));
  const isJanStart = startMonthNum === 1;
  const years = useMemo(
    () => Array.from({ length: horizonX + 1 }, (_, i) => cy + i),
    [cy, horizonX],
  );
  const weightYear = isJanStart ? cy : cy + 1;

  const [rows, setRows] = useState<Row[]>([]);
  const [activeClients, setActiveClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // Add-client dropdown (anchored to the button)
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const addWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    getRevenueData(planVersionId).then((data) => {
      if (!alive) return;
      setRows(
        data.clients.map((c) => ({
          entityId: c.entityId,
          name: c.name,
          revenue: Object.fromEntries(
            years.map((y) => [y, c.revenueByYear[y] != null ? String(c.revenueByYear[y]) : ""]),
          ),
          seasonality: Object.fromEntries(
            JAN_NOV.map((m) => [m, c.seasonalityByMonth[m] != null ? String(c.seasonalityByMonth[m]) : ""]),
          ),
        })),
      );
      setActiveClients(data.activeClients);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planVersionId]);

  // Close the add-dropdown on click-away or Escape.
  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (addWrapRef.current && !addWrapRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAddOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [addOpen]);

  // ── Seasonality math (unchanged mechanic) ───────────────────────────────────
  const rowCurve = (r: Row): number[] => {
    const jn = JAN_NOV.map((m) => Number(r.seasonality[m]) || 0);
    return [...jn, 100 - jn.reduce((a, b) => a + b, 0)];
  };
  const rowDec = (r: Row) => 100 - JAN_NOV.reduce((n, m) => n + (Number(r.seasonality[m]) || 0), 0);
  // Same rule as the Total row's "—": nothing to derive from → show nothing. A row
  // whose Jan–Nov is ENTIRELY blank has no entered curve, so Dec renders blank rather
  // than asserting Dec = 100 (a plausible-looking number nobody typed). One digit in
  // any Jan–Nov cell → Dec computes normally. Display-only; the save mechanic is
  // unchanged (an untouched curve still derives Dec = 100 − 0 server-side).
  const rowSeasonEmpty = (r: Row) => JAN_NOV.every((m) => (r.seasonality[m] ?? "") === "");

  // Total-row seasonality = 1st-full-year revenue-weighted average of the clients'
  // curves (DATASET §3.3). This is now the ONLY call site — the new-client default
  // was removed (clients start with an EMPTY curve). Returns null when there are no
  // revenue weights (wsum === 0) — nothing to average yet — so the Total row shows
  // "—" rather than a fabricated flat default.
  function weightedAvgCurve(srcRows: Row[]): number[] | null {
    const weights = srcRows.map((r) => Number(r.revenue[weightYear]) || 0);
    const wsum = weights.reduce((a, b) => a + b, 0);
    if (wsum === 0) return null;
    const acc = Array(12).fill(0);
    srcRows.forEach((r, i) => {
      const c = rowCurve(r);
      for (let m = 0; m < 12; m++) acc[m] += weights[i] * c[m];
    });
    return acc.map((v) => v / wsum);
  }

  // ── Cell editing ────────────────────────────────────────────────────────────
  const setRevCell = (i: number, year: number, raw: string) => {
    const v = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setError(null);
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, revenue: { ...r.revenue, [year]: v } } : r)));
  };
  const setSeasonCell = (i: number, month: number, v: string) => {
    setError(null);
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, seasonality: { ...r.seasonality, [month]: v } } : r)));
  };

  const totalForYear = (year: number) => rows.reduce((n, r) => n + (Number(r.revenue[year]) || 0), 0);
  const anyNegativeDec = rows.some((r) => rowDec(r) < 0);
  const totalCurve = weightedAvgCurve(rows);

  // ── Add / delete ────────────────────────────────────────────────────────────
  const inTable = useMemo(() => new Set(rows.map((r) => r.entityId)), [rows]);
  const query = addText.trim().toLowerCase();
  const options = activeClients.filter((c) => !inTable.has(c.id) && c.name.toLowerCase().includes(query));
  const exactMatch = activeClients.find((c) => c.name.trim().toLowerCase() === query && query.length > 0);
  const showCreate = query.length > 0 && !exactMatch;

  function addRow(entityId: string, name: string) {
    setError(null);
    setRows((rs) =>
      rs.some((r) => r.entityId === entityId)
        ? rs
        : [
            ...rs,
            {
              entityId,
              name,
              revenue: Object.fromEntries(years.map((y) => [y, ""])),
              seasonality: Object.fromEntries(JAN_NOV.map((m) => [m, ""])), // EMPTY — user enters all weights
            },
          ],
    );
    setAddOpen(false);
    setAddText("");
    setAddError(null);
  }
  function pickCreate() {
    const text = addText.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await createRevenueClient(text);
      if (!res.ok) return setAddError(res.error);
      setActiveClients((a) => [...a, { id: res.id, name: res.name }]);
      addRow(res.id, res.name);
    });
  }

  const toggleCheck = (id: string) =>
    setChecked((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  function onDeleteChecked() {
    if (checked.size === 0) return;
    const ids = [...checked];
    startTransition(async () => {
      const res = await deleteClients(planVersionId, ids);
      if (!res.ok) return setError(res.error);
      setRows((rs) => rs.filter((r) => !checked.has(r.entityId)));
      setChecked(new Set());
    });
  }

  // ── Save & Next ─────────────────────────────────────────────────────────────
  function onSaveNext() {
    if (anyNegativeDec) return;
    setBusy(true);
    setError(null);
    saveRevenue(
      planVersionId,
      rows.map((r) => ({
        entityId: r.entityId,
        revenueByYear: Object.fromEntries(years.map((y) => [y, Number(r.revenue[y]) || 0])),
        seasonality: Object.fromEntries(JAN_NOV.map((m) => [m, Number(r.seasonality[m]) || 0])),
      })),
    ).then((res) => {
      setBusy(false);
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  const partial = !isJanStart;
  const startMonthName = MONTHS_LONG[startMonthNum - 1];
  const colSpanFull = years.length + 1 + 12;

  if (loading) return <p className={styles.note}>Loading revenue…</p>;

  return (
    <div>
      <div className={styles.revToolbar}>
        <div className={styles.revToolbarLeft}>
          <div className={styles.addWrap} ref={addWrapRef}>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => {
                setAddOpen((o) => !o);
                setAddText("");
                setAddError(null);
              }}
            >
              + Add client
            </button>
            {addOpen && (
              <div className={styles.addDropdown}>
                <input
                  className={styles.comboInput}
                  value={addText}
                  autoFocus
                  placeholder="Filter or type a new name…"
                  onChange={(e) => {
                    setAddText(e.target.value);
                    setAddError(null);
                  }}
                />
                <ul className={styles.comboList}>
                  {options.map((c) => (
                    <li key={c.id} className={styles.comboItem} onClick={() => addRow(c.id, c.name)}>
                      {c.name}
                    </li>
                  ))}
                  {showCreate && (
                    <li className={`${styles.comboItem} ${styles.comboCreate}`} onClick={pickCreate}>
                      {pending ? "Creating…" : `Create new: ${addText.trim()}`}
                    </li>
                  )}
                  {options.length === 0 && !showCreate && (
                    <li className={styles.comboEmpty}>No matching clients</li>
                  )}
                </ul>
                {addError && <div className={styles.warnSoft}>{addError}</div>}
              </div>
            )}
          </div>
          <button
            className={styles.secondary}
            type="button"
            onClick={onDeleteChecked}
            disabled={checked.size === 0 || pending}
          >
            Delete client{checked.size > 1 ? "s" : ""}
          </button>
        </div>
        {anyNegativeDec && <span className={styles.sumBad}>Fix seasonality over 100% to continue</span>}
      </div>

      <div className={styles.revTableWrap}>
        <table className={styles.revTable}>
          <thead>
            <tr className={styles.groupRow}>
              <th className={`${styles.stickyCol} ${styles.stickyHead}`} aria-hidden />
              <th className={styles.groupHead} colSpan={years.length}>Revenue ($)</th>
              <th className={styles.gapCol} aria-hidden />
              <th className={styles.groupHead} colSpan={12}>Seasonality (%)</th>
            </tr>
            <tr>
              <th className={`${styles.stickyCol} ${styles.stickyHead}`}>Client</th>
              {years.map((y, i) => (
                <th key={y} className={styles.yearHead}>
                  <div className={styles.yearTag}>{i === 0 ? "CY" : `CY+${i}`}</div>
                  <div>
                    {y}
                    {i === 0 && partial ? <span className={styles.asterisk}>*</span> : ""}
                  </div>
                </th>
              ))}
              <th className={styles.gapCol} aria-hidden />
              {MONTHS_SHORT.map((m) => (
                <th key={m} className={styles.monthHead}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dec = rowDec(r);
              const seasonEmpty = rowSeasonEmpty(r);
              return (
                <tr key={r.entityId}>
                  <td className={`${styles.stickyCol} ${styles.clientCell}`}>
                    <label className={styles.clientLabel}>
                      <input
                        type="checkbox"
                        checked={checked.has(r.entityId)}
                        onChange={() => toggleCheck(r.entityId)}
                        aria-label={`Select ${r.name}`}
                      />
                      <span>{r.name}</span>
                    </label>
                  </td>
                  {years.map((y) => (
                    <td key={y} className={styles.revCell}>
                      <MoneyInput
                        className={styles.revInput}
                        value={r.revenue[y] ?? ""}
                        onChangeRaw={(v) => setRevCell(i, y, v)}
                        ariaLabel={`${r.name} revenue ${y}`}
                      />
                    </td>
                  ))}
                  <td className={styles.gapCol} aria-hidden />
                  {JAN_NOV.map((m) => (
                    <td key={m} className={styles.seasonCell}>
                      <span className={styles.seasonPctField}>
                        <input
                          className={styles.seasonInput}
                          type="text"
                          inputMode="numeric"
                          value={r.seasonality[m] ?? ""}
                          onChange={(e) => handleDigits(e, 3, (v) => setSeasonCell(i, m, v))}
                          aria-label={`${r.name} ${MONTHS_SHORT[m - 1]} %`}
                        />
                        <span className={styles.seasonPctSuffix}>%</span>
                      </span>
                    </td>
                  ))}
                  <td
                    className={`${styles.seasonCell} ${styles.derivedDec} ${
                      !seasonEmpty && dec < 0 ? styles.decError : ""
                    }`}
                  >
                    {seasonEmpty ? (
                      ""
                    ) : (
                      <>
                        {dec}
                        <span className={styles.autoTag}>auto</span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className={`${styles.stickyCol} ${styles.clientCell}`}>—</td>
                <td className={styles.emptyRow} colSpan={colSpanFull}>
                  No clients yet. Use “Add client” to start.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={`${styles.stickyCol} ${styles.totalLabel}`}>Total</td>
                {years.map((y) => (
                  <td key={y} className={styles.totalCell}>{totalForYear(y).toLocaleString()}</td>
                ))}
                <td className={styles.gapCol} aria-hidden />
                {totalCurve
                  ? totalCurve.map((v, idx) => (
                      <td key={idx} className={styles.totalCell}>{v.toFixed(1)}</td>
                    ))
                  : MONTHS_SHORT.map((m) => (
                      <td key={m} className={styles.totalCell}>—</td>
                    ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className={styles.entityNote}>
        New clients created here get <strong>Type = Client</strong>,{" "}
        <strong>Payment Flow = AR</strong>, <strong>Payment Term = Statement + 30</strong>,{" "}
        <strong>Currency = USD</strong>. You can finish their details in Master Data now or
        any time before generating the report.
      </p>

      {partial && (
        <p className={styles.footnote}>
          <span className={styles.asterisk}>*</span> CY {cy} is a partial year — enter{" "}
          {startMonthName}–December only.
        </p>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button className={styles.secondary} type="button" onClick={onBack} disabled={busy}>
          Back
        </button>
        <button
          className={styles.primary}
          type="button"
          onClick={onSaveNext}
          disabled={busy || anyNegativeDec}
        >
          {busy ? "Saving…" : "Save & Next"}
        </button>
      </div>
    </div>
  );
}
