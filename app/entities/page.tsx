import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { getReferencedEntityIds } from "./references";
import EntityActions from "./EntityActions";
import styles from "./entities.module.css";

// Always read fresh from the DB (master data changes should show immediately).
export const dynamic = "force-dynamic";

function paymentTerm(anchor: string | null, days: number | null) {
  if (!anchor && days == null) return "—";
  return `${anchor ?? "—"} + ${days ?? "—"}d`;
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showArchived = tab === "archived";

  const entities = await prisma.entity.findMany({
    where: { archivedAt: showArchived ? { not: null } : null },
    orderBy: { createdAt: "desc" },
  });

  // One grouped query for the whole listed set — NOT one per row.
  const referenced = await getReferencedEntityIds(entities.map((e) => e.id));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.h1}>Entities</h1>
        <Link href="/entities/new" className={styles.primary}>
          + New entity
        </Link>
      </div>

      <div className={styles.tabs}>
        <Link
          href="/entities"
          className={showArchived ? styles.tab : styles.tabActive}
        >
          Active
        </Link>
        <Link
          href="/entities?tab=archived"
          className={showArchived ? styles.tabActive : styles.tab}
        >
          Archived
        </Link>
      </div>

      {entities.length === 0 ? (
        <p className={styles.empty}>
          {showArchived
            ? "No archived entities."
            : "No entities yet. Create your first one."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Payment Flow</th>
                <th>Payment Term</th>
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link className={styles.rowLink} href={`/entities/${e.id}`}>
                      {e.name ?? "(unnamed)"}
                    </Link>
                  </td>
                  <td>{e.type ?? "—"}</td>
                  <td>{e.paymentFlow ?? "—"}</td>
                  <td>{paymentTerm(e.paymentTermAnchor, e.paymentTermDays)}</td>
                  <td>{e.tags ?? "—"}</td>
                  <td className={styles.rowActions}>
                    <Link href={`/entities/${e.id}`}>View</Link>
                    <Link href={`/entities/${e.id}/edit`}>Edit</Link>
                    <EntityActions
                      id={e.id}
                      archived={showArchived}
                      isReferenced={referenced.has(e.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
