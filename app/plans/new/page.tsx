import PlanWizard from "../PlanWizard";

export const dynamic = "force-dynamic";

// Defaults computed server-side to avoid client/server hydration mismatch:
//   file name → WF-001-YYYYMMDD (editable), start month → current month.
export default function NewPlanPage() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return (
    <PlanWizard
      defaultName={`WF-001-${yyyy}${mm}${dd}`}
      defaultStartMonth={`${yyyy}-${mm}`}
    />
  );
}
