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

type Row = { entityId: string; name: string; revenue: Record<number, string> };

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

  const [rows, setRows] = useState<Row[]>([]);
  const [activeClients, setActiveClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Draft-row (Add client) state
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

  const setCell = (i: number, year: number, raw: string) => {
    const v = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setSaved(false);
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, revenue: { ...r.revenue, [year]: v } } : r)));
  };

  const totalForYear = (year: number) =>
    rows.reduce((n, r) => n + (Number(r.revenue[year]) || 0), 0);

  // ── Add-client draft ────────────────────────────────────────────────────────
  const inTable = useMemo(() => new Set(rows.map((r) => r.entityId)), [rows]);
  const query = draftText.trim().toLowerCase();
  const candidates = activeClients.filter(
    (c) => !inTable.has(c.id) && c.name.toLowerCase().includes(query),
  );
  const exactActive = activeClients.find(
    (c) => c.name.trim().toLowerCase() === query && query.length > 0,
  );
  const showCreate = query.length > 0 && !exactActive; // BL-014: archived aren't in activeClients → still "create new"

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
    setRows((rs) => [...rs, { entityId, name, revenue: Object.fromEntries(years.map((y) => [y, ""])) }]);
    closeDraft();
  }
  function commitDraft() {
    setDraftError(null);
    if (draftChosenId) {
      if (inTable.has(draftChosenId)) return setDraftError("This client is already in the plan.");
      addRow(draftChosenId, activeClients.find((c) => c.id === draftChosenId)?.name ?? draftText.trim());
      return;
    }
    const text = draftText.trim();
    if (!text) return setDraftError("Type a name, or pick a client.");
    const exact = activeClients.find((c) => c.name.trim().toLowerCase() === text.toLowerCase());
    if (exact) {
      if (inTable.has(exact.id)) return setDraftError("This client is already in the plan.");
      return addRow(exact.id, exact.name); // matched an existing active client — link, don't duplicate
    }
    // create new inline
    startTransition(async () => {
      const res = await createRevenueClient(text);
      if (!res.ok) return setDraftError(res.error);
      setActiveClients((a) => [...a, { id: res.id, name: res.name }]);
      addRow(res.id, res.name);
    });
  }

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
  const colSpanFull = years.length + 1 + 12;

  if (loading) return <p className={styles.note}>Loading revenue…</p>;

  return (
    <div>
      <div className={styles.revToolbar}>
        <button className={styles.secondary} type="button" onClick={openDraft} disabled={draftOpen}>
          + Add client
        </button>
        <span className={styles.revToolbarRight}>
          {saved && <span className={styles.savedTag}>Saved ✓</span>}
          <button
            className={styles.primary}
            type="button"
            onClick={onSave}
            disabled={saving || rows.length === 0}
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
            {rows.map((r, i) => (
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
                {MONTHS_SHORT.map((m) => (
                  <td key={m} className={styles.seasonPlaceholder}>—</td>
                ))}
              </tr>
            ))}

            {/* Inline draft row — untinted; commits only on explicit "Add client". */}
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
                {MONTHS_SHORT.map((m) => (
                  <td key={m} className={styles.seasonPlaceholder}>—</td>
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
