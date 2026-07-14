import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { getEntityReferences, isReferenced } from "../references";
import EntityActions from "../EntityActions";
import styles from "../entities.module.css";

export const dynamic = "force-dynamic";

function paymentTerm(anchor: string | null, days: number | null) {
  if (!anchor && days == null) return "—";
  return `${anchor ?? "—"} + ${days ?? "—"} days`;
}

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await prisma.entity.findUnique({ where: { id } });
  if (!e) notFound();

  const refs = await getEntityReferences(e.id);
  const archived = e.archivedAt !== null;

  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  const rows: { label: string; value: string }[] = [
    { label: "Name", value: e.name ?? "—" },
    { label: "Type", value: e.type ?? "—" },
    { label: "Payment Flow", value: e.paymentFlow ?? "—" },
    {
      label: "Payment Term",
      value: paymentTerm(e.paymentTermAnchor, e.paymentTermDays),
    },
    // Currency intentionally NOT shown (Ph1 fixed USD default).
    { label: "Tags", value: e.tags ?? "—" },
    { label: "Comments", value: e.comments ?? "—" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/entities">← All entities</Link>
      </div>

      <div className={styles.header}>
        <h1 className={styles.h1}>
          {e.name ?? "(unnamed)"}
          {archived && <span className={styles.archivedTag}>Archived</span>}
        </h1>
        <div className={styles.actions}>
          <Link href={`/entities/${e.id}/edit`} className={styles.secondary}>
            Edit
          </Link>
          <EntityActions
            id={e.id}
            archived={archived}
            isReferenced={isReferenced(refs)}
          />
        </div>
      </div>

      {/* Usage breakdown — reconciliation slot renders as "— (Phase 3)", never 0. */}
      <p className={styles.usage}>
        Used in: <strong>{plural(refs.publishedPlans, "published plan")}</strong>,{" "}
        <strong>{plural(refs.draftPlans, "draft plan")}</strong>,{" "}
        <strong>— (Phase 3)</strong> reconciliations
      </p>

      <dl className={styles.card}>
        {rows.map((r) => (
          <div key={r.label} className={styles.cardRow}>
            <dt className={styles.dt}>{r.label}</dt>
            <dd className={styles.dd}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
