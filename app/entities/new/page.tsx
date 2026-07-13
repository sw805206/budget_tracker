import { prisma } from "@/app/lib/prisma";
import EntityForm from "../EntityForm";

export const dynamic = "force-dynamic";

export default async function NewEntityPage() {
  // Existing names power the non-blocking duplicate-name warning.
  const existingNames = await prisma.entity.findMany({
    select: { id: true, name: true },
  });
  return <EntityForm mode="create" existingNames={existingNames} />;
}
