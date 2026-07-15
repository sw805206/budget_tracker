import { notFound, redirect } from "next/navigation";
import PlanWizard from "../../PlanWizard";
import { getResumeData } from "../../actions";

export const dynamic = "force-dynamic";

// Resume a Draft into the wizard (BL-019). Keyed by PlanVersion (a /plans row = one
// version). The Plans-list resume glyph only renders for Draft rows, but this route is
// also reachable by direct URL — so it guards immutability itself: a Published version
// redirects to /plans rather than opening an immutable plan into an editing wizard
// (DATASET §5). A missing/unknown id → 404.
export default async function ResumePlanPage({
  params,
}: {
  params: Promise<{ planVersionId: string }>;
}) {
  const { planVersionId } = await params;
  const resume = await getResumeData(planVersionId);
  if (!resume) notFound();
  if (resume.status === "Published") redirect("/plans");

  return (
    <PlanWizard
      defaultName={resume.name}
      defaultStartMonth={resume.startMonth}
      resume={resume}
    />
  );
}
