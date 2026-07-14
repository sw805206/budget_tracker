"use client";

import { useEffect, useMemo, useState } from "react";
import { getRevenueData, saveRevenue } from "./revenue-actions";
import styles from "./plans.module.css";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Row = { entityId: string; name: string; revenue: Record<number, string> };

export default function RevenueStep({
  planVersionId,
  startMonth,
  horizonX,
}: {
  planVersionId: string;
  startMonth: string; // "yyyy-mm"
  horizonX: number;
}) {
  // Year columns are DERIVED from horizonX (x+1 columns) — never hardcoded.
  const cy = Number(startMonth.slice(0, 4));
  const startMonthNum = Number(startMonth.slice(5, 7));
  const isJanStart = startMonthNum === 1;
  const years = useMemo(
    () => Array.from({ length: horizonX + 1 }, (_, i) => cy + i),
    [cy, horizonX],
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        })),
      );
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planVersionId]);

  const setCell = (i: number, year: number, raw: string) => {
    // dollars: digits + optional single decimal point
    const v = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setSaved(false);
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, revenue: { ...r.revenue, [year]: v } } : r)));
  };

  const totalForYear = (year: number) =>
    rows.reduce((n, r) => n + (Number(r.revenue[year]) || 0), 0);

  function onSave() {
    setSaving(true);
    setSaved(false);
    saveRevenue(
      planVersionId,
      rows.map((r) => ({
        entityId: r.entityId,
        revenueByYear: Object.fromEntries(years.map((y) => [y, Number(r.revenue[y]) || 0])),
      })),
    ).then((res) => {
      setSaving(false);
      if (res.ok) setSaved(true);
    });
  }

  const partial = !isJanStart;
  const startMonthName = MONTHS_LONG[startMonthNum - 1];

  if (loading) return <p className={styles.note}>Loading revenue…</p>;

  return (
    <div>
      <div className={styles.revToolbar}>
        <button className={styles.secondary} type="button" disabled>
          + Add client
        </button>
        <span className={styles.revToolbarNote}>(client entry — next gate)</span>
        <span className={styles.revToolbarRight}>
          {saved && <span className={styles.savedTag}>Saved ✓</span>}
          <button className={styles.primary} type="button" onClick={onSave} disabled={saving || rows.length === 0}>
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
            {rows.length === 0 ? (
              <tr>
                <td className={styles.stickyCol}>—</td>
                <td className={styles.emptyRow} colSpan={years.length + 1 + 12}>
                  No clients yet. Use “Add client” to start.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.entityId}>
                  <td className={`${styles.stickyCol} ${styles.clientCell}`}>{r.name}</td>
                  {years.map((y) => (
                    <td key={y} className={styles.revCell}>
                      <input
                        className={styles.revInput}
                        type="text"
                        inputMode="decimal"
                        value={r.revenue[y] ?? ""}
                        onChange={(e) => setCell(i, y, e.target.value)}
                        aria-label={`${r.name} revenue ${y}`}
                      />
                    </td>
                  ))}
                  <td className={styles.gapCol} aria-hidden />
                  {/* Seasonality — built in Gate 3; placeholders for now. */}
                  {MONTHS_SHORT.map((m) => (
                    <td key={m} className={styles.seasonPlaceholder}>—</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={`${styles.stickyCol} ${styles.totalLabel}`}>Total</td>
                {years.map((y) => (
                  <td key={y} className={styles.totalCell}>
                    {totalForYear(y).toLocaleString()}
                  </td>
                ))}
                <td className={styles.gapCol} aria-hidden />
                {MONTHS_SHORT.map((m) => (
                  <td key={m} className={styles.seasonPlaceholder}>—</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {partial && (
        <p className={styles.footnote}>
          <span className={styles.asterisk}>*</span> CY {cy} is a partial year — enter{" "}
          {startMonthName}–December only.
        </p>
      )}
    </div>
  );
}
