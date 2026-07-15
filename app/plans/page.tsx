import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { STEP_WAREHOUSE, STEP_DELIVERY } from "./constants";
import PlanRowActions from "./PlanRowActions";
import styles from "./plans.module.css";

export const dynamic = "force-dynamic";

// Minimal Plans listing. Tolerates incomplete Drafts gracefully — a Plan/PlanVersion
// created at Step 1 but not yet through Step 2 has default params and no selections;
// every field is rendered defensively (no crash on missing structure).
export default async function PlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      versions: { orderBy: { createdAt: "desc" } },
      stepSelections: true,
    },
  });

  // Flatten to one row per PlanVersion (Create-New makes one version per plan).
  const rows = plans.flatMap((p) =>
    (p.versions.length ? p.versions : [null]).map((v) => {
      const wh = p.stepSelections.filter((s) => s.step === STEP_WAREHOUSE).length;
      const dl = p.stepSelections.filter((s) => s.step === STEP_DELIVERY).length;
      return {
        key: v ? v.id : p.id,
        // versionId is null for a version-less Plan row (the workflow card): it is
        // permanent and carries no delete control. Only real versions are deletable.
        versionId: v ? v.id : null,
        name: v?.name ?? "(no version)",
        customer: p.customer,
        startMonth: v?.startMonth ?? "—",
        status: v?.status ?? "—",
        horizon: v ? v.horizonX : "—",
        structure: wh + dl === 0 ? "not set" : `${wh} wh / ${dl} delivery`,
      };
    }),
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.h1}>Plans</h1>
        <Link href="/plans/new" className={styles.primary}>
          + Create New
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>No plans yet. Create your first one.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>File name</th>
                <th>Customer</th>
                <th>Start</th>
                <th>Status</th>
                <th>Horizon</th>
                <th>Structure</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.name}</td>
                  <td>{r.customer}</td>
                  <td>{r.startMonth}</td>
                  <td>
                    <span className={r.status === "Published" ? styles.pubTag : styles.draftTag}>
                      {r.status}
                    </span>
                  </td>
                  <td>CY + {r.horizon}</td>
                  <td>{r.structure}</td>
                  <td>
                    {r.versionId && (
                      <PlanRowActions planVersionId={r.versionId} status={r.status} />
                    )}
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
