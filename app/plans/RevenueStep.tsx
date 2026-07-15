"use client";

import {
  useEffect,
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

  // ONE function, two call sites (new-client default + Total row).
  function weightedAvgCurve(srcRows: Row[]): number[] {
    const weights = srcRows.map((r) => Number(r.revenue[weightYear]) || 0);
    const wsum = weights.reduce((a, b) => a + b, 0);
    if (srcRows.length === 0 || wsum === 0) return Array.from({ length: 12 }, () => 100 / 12);
    const acc = Array(12).fill(0);
    srcRows.forEach((r, i) => {
      const c = rowCurve(r);
      for (let m = 0; m < 12; m++) acc[m] += weights[i] * c[m];
    });
    return acc.map((v) => v / wsum);
  }
  function roundTo100(curve: number[]): number[] {
    const floors = curve.map((v) => Math.floor(v));
    const out = [...floors];
    const deficit = 100 - floors.reduce((a, b) => a + b, 0);
    const order = curve.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < deficit && k < order.length; k++) out[order[k].i] += 1;
    return out;
  }
  function defaultJanNov(srcRows: Row[]): Record<number, string> {
    const ints = roundTo100(weightedAvgCurve(srcRows));
    return Object.fromEntries(JAN_NOV.map((m, idx) => [m, String(ints[idx])]));
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
              seasonality: defaultJanNov(rs),
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
                      <input
                        className={styles.revInput}
                        type="text"
                        inputMode="decimal"
                        value={r.revenue[y] ?? ""}
                        onChange={(e) => setRevCell(i, y, e.target.value)}
                        aria-label={`${r.name} revenue ${y}`}
                      />
                    </td>
                  ))}
                  <td className={styles.gapCol} aria-hidden />
                  {JAN_NOV.map((m) => (
                    <td key={m} className={styles.seasonCell}>
                      <input
                        className={styles.seasonInput}
                        type="text"
                        inputMode="numeric"
                        value={r.seasonality[m] ?? ""}
                        onChange={(e) => handleDigits(e, 3, (v) => setSeasonCell(i, m, v))}
                        aria-label={`${r.name} ${MONTHS_SHORT[m - 1]} %`}
                      />
                    </td>
                  ))}
                  <td className={`${styles.seasonCell} ${styles.derivedDec} ${dec < 0 ? styles.decError : ""}`}>
                    {dec}
                    <span className={styles.autoTag}>auto</span>
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
                {totalCurve.map((v, idx) => (
                  <td key={idx} className={styles.totalCell}>{v.toFixed(1)}</td>
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
