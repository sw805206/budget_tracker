import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import styles from "./entities.module.css";

// Always read fresh from the DB (master data changes should show immediately).
export const dynamic = "force-dynamic";

function paymentTerm(anchor: string | null, days: number | null) {
  if (!anchor && days == null) return "—";
  return `${anchor ?? "—"} + ${days ?? "—"}d`;
}

export default async function EntitiesPage() {
  const entities = await prisma.entity.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.h1}>Entities</h1>
        <Link href="/entities/new" className={styles.primary}>
          + New entity
        </Link>
      </div>

      {entities.length === 0 ? (
        <p className={styles.empty}>
          No entities yet. Create your first one.
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
