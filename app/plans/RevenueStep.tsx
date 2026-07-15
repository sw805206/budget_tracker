"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getRevenueData,
  saveRevenue,
  createRevenueClient,
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
  revenue: Record<number, string>; // year -> amount string
  seasonality: Record<number, string>; // month 1..11 -> weight string (Dec derived)
};

export default function RevenueStep({
  planVersionId,
  startMonth,
  horizonX,
}: {
  planVersionId: string;
  startMonth: string;
  horizonX: number;
}) {
  const cy = Number(startMonth.slice(0, 4));
  const startMonthNum = Number(startMonth.slice(5, 7));
  const isJanStart = startMonthNum === 1;
  const years = useMemo(
    () => Array.from({ length: horizonX + 1 }, (_, i) => cy + i),
    [cy, horizonX],
  );
  // Seasonality default weight = each client's 1st-full-year revenue (CY if Jan-start, else CY+1).
  const weightYear = isJanStart ? cy : cy + 1;

  const [rows, setRows] = useState<Row[]>([]);
  const [activeClients, setActiveClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftChosenId, setDraftChosenId] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  // ── Seasonality math ────────────────────────────────────────────────────────
  // A row's full 12-month curve (Dec derived = 100 − sum(Jan:Nov)).
  const rowCurve = (r: Row): number[] => {
    const jn = JAN_NOV.map((m) => Number(r.seasonality[m]) || 0);
    return [...jn, 100 - jn.reduce((a, b) => a + b, 0)];
  };
  const rowDec = (r: Row) => 100 - JAN_NOV.reduce((n, m) => n + (Number(r.seasonality[m]) || 0), 0);

  // ONE function, two call sites (new-client default + Total row): the 1st-full-year
  // revenue-weighted average of the given curves. Flat 1/12 when the weight-sum is 0.
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
  // Largest-remainder rounding of a 12-curve to integers summing to 100.
  function roundTo100(curve: number[]): number[] {
    const floors = curve.map((v) => Math.floor(v));
    const out = [...floors];
    let deficit = 100 - floors.reduce((a, b) => a + b, 0);
    const order = curve
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < deficit && k < order.length; k++) out[order[k].i] += 1;
    return out;
  }
  // Default Jan–Nov (integer strings) for a new client, from the existing curves.
  function defaultJanNov(srcRows: Row[]): Record<number, string> {
    const ints = roundTo100(weightedAvgCurve(srcRows));
    return Object.fromEntries(JAN_NOV.map((m, idx) => [m, String(ints[idx])]));
  }

  // ── Cell editing ────────────────────────────────────────────────────────────
  const setRevCell = (i: number, year: number, raw: string) => {
    const v = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setSaved(false);
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, revenue: { ...r.revenue, [year]: v } } : r)));
  };
  const setSeasonCell = (i: number, month: number, raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 3); // integer, no spinner
    setSaved(false);
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, seasonality: { ...r.seasonality, [month]: v } } : r)));
  };

  const totalForYear = (year: number) => rows.reduce((n, r) => n + (Number(r.revenue[year]) || 0), 0);
  const anyNegativeDec = rows.some((r) => rowDec(r) < 0);
  const totalCurve = weightedAvgCurve(rows);

  // ── Add-client draft ────────────────────────────────────────────────────────
  const inTable = useMemo(() => new Set(rows.map((r) => r.entityId)), [rows]);
  const query = draftText.trim().toLowerCase();
  const candidates = activeClients.filter((c) => !inTable.has(c.id) && c.name.toLowerCase().includes(query));
  const exactActive = activeClients.find((c) => c.name.trim().toLowerCase() === query && query.length > 0);
  const showCreate = query.length > 0 && !exactActive;

  function openDraft() {
    setDraftOpen(true);
    setDraftText("");
    setDraftChosenId(null);
    setDraftError(null);
    setComboOpen(true);
  }
  function closeDraft() {
    setDraftOpen(false);
    setComboOpen(false);
    setDraftText("");
    setDraftChosenId(null);
    setDraftError(null);
  }
  function addRow(entityId: string, name: string) {
    setSaved(false);
    setRows((rs) => [
      ...rs,
      {
        entityId,
        name,
        revenue: Object.fromEntries(years.map((y) => [y, ""])),
        seasonality: defaultJanNov(rs), // default from the curves that exist now
      },
    ]);
    closeDraft();
  }
  function commitDraft() {
    setDraftError(null);
    if (draftChosenId) {
      if (inTable.has(draftChosenId)) return setDraftError("This client is already in the plan.");
      return addRow(draftChosenId, activeClients.find((c) => c.id === draftChosenId)?.name ?? draftText.trim());
    }
    const text = draftText.trim();
    if (!text) return setDraftError("Type a name, or pick a client.");
    const exact = activeClients.find((c) => c.name.trim().toLowerCase() === text.toLowerCase());
    if (exact) {
      if (inTable.has(exact.id)) return setDraftError("This client is already in the plan.");
      return addRow(exact.id, exact.name);
    }
    startTransition(async () => {
      const res = await createRevenueClient(text);
      if (!res.ok) return setDraftError(res.error);
      setActiveClients((a) => [...a, { id: res.id, name: res.name }]);
      addRow(res.id, res.name);
    });
  }

  function onSave() {
    if (anyNegativeDec) return;
    setSaving(true);
    setSaved(false);
    saveRevenue(
      planVersionId,
      rows.map((r) => ({
        entityId: r.entityId,
        revenueByYear: Object.fromEntries(years.map((y) => [y, Number(r.revenue[y]) || 0])),
        seasonality: Object.fromEntries(JAN_NOV.map((m) => [m, Number(r.seasonality[m]) || 0])),
      })),
    ).then((res) => {
      setSaving(false);
      if (res.ok) setSaved(true);
      else setDraftError(res.error);
    });
  }

  const partial = !isJanStart;
  const startMonthName = MONTHS_LONG[startMonthNum - 1];
  const colSpanFull = years.length + 1 + 12;
  const draftPreview = draftOpen ? roundTo100(weightedAvgCurve(rows)) : null;

  if (loading) return <p className={styles.note}>Loading revenue…</p>;

  return (
    <div>
      <div className={styles.revToolbar}>
        <button className={styles.secondary} type="button" onClick={openDraft} disabled={draftOpen}>
          + Add client
        </button>
        <span className={styles.revToolbarRight}>
          {anyNegativeDec && <span className={styles.sumBad}>Fix seasonality over 100% to save</span>}
          {saved && <span className={styles.savedTag}>Saved ✓</span>}
          <button
            className={styles.primary}
            type="button"
            onClick={onSave}
            disabled={saving || rows.length === 0 || anyNegativeDec}
          >
            {saving ? "Saving…" : "Save revenue"}
          </button>
        </span>
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
                  <td className={`${styles.stickyCol} ${styles.clientCell}`}>{r.name}</td>
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
                        onChange={(e) => setSeasonCell(i, m, e.target.value)}
                        aria-label={`${r.name} ${MONTHS_SHORT[m - 1]} %`}
                      />
                    </td>
                  ))}
                  {/* Dec — derived, read-only, AUTO; error when negative. */}
                  <td className={`${styles.seasonCell} ${styles.derivedDec} ${dec < 0 ? styles.decError : ""}`}>
                    {dec}
                    <span className={styles.autoTag}>auto</span>
                  </td>
                </tr>
              );
            })}

            {draftOpen && (
              <tr className={styles.draftRow}>
                <td className={`${styles.stickyCol} ${styles.draftCell}`}>
                  <div className={styles.combo}>
                    <input
                      className={styles.comboInput}
                      value={draftText}
                      autoFocus
                      placeholder="Type or pick a client…"
                      onFocus={() => setComboOpen(true)}
                      onBlur={() => setTimeout(() => setComboOpen(false), 120)}
                      onChange={(e) => {
                        setDraftText(e.target.value);
                        setDraftChosenId(null);
                        setComboOpen(true);
                        setDraftError(null);
                      }}
                    />
                    {comboOpen && (candidates.length > 0 || showCreate) && (
                      <ul className={styles.comboList}>
                        {candidates.map((c) => (
                          <li
                            key={c.id}
                            className={styles.comboItem}
                            onMouseDown={() => {
                              setDraftChosenId(c.id);
                              setDraftText(c.name);
                              setComboOpen(false);
                            }}
                          >
                            {c.name}
                          </li>
                        ))}
                        {showCreate && (
                          <li
                            className={`${styles.comboItem} ${styles.comboCreate}`}
                            onMouseDown={() => {
                              setDraftChosenId(null);
                              setComboOpen(false);
                            }}
                          >
                            Create new client “{draftText.trim()}”
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className={styles.draftActions}>
                    <button className={styles.miniPrimary} type="button" onClick={commitDraft} disabled={pending}>
                      {pending ? "…" : "Add client"}
                    </button>
                    <button className={styles.miniSecondary} type="button" onClick={closeDraft}>
                      Cancel
                    </button>
                  </div>
                  {draftError && <div className={styles.warnSoft}>{draftError}</div>}
                </td>
                {years.map((y) => (
                  <td key={y} className={styles.revCell}>
                    <input className={styles.revInput} type="text" disabled placeholder="—" />
                  </td>
                ))}
                <td className={styles.gapCol} aria-hidden />
                {/* Draft previews the same default curve it will get on commit. */}
                {draftPreview!.map((v, idx) => (
                  <td key={idx} className={`${styles.seasonCell} ${styles.previewCell}`}>{v}</td>
                ))}
              </tr>
            )}

            {rows.length === 0 && !draftOpen && (
              <tr>
                <td className={styles.stickyCol}>—</td>
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
                {/* Total seasonality = same weighted average (derived, never stored). */}
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
    </div>
  );
}
