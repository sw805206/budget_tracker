import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import EntityForm from "../../EntityForm";

export const dynamic = "force-dynamic";

export default async function EditEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await prisma.entity.findUnique({ where: { id } });
  if (!e) notFound();

  const existingNames = await prisma.entity.findMany({
    select: { id: true, name: true },
  });

  return (
    <EntityForm
      mode="edit"
      existingNames={existingNames}
      initial={{
        id: e.id,
        name: e.name,
        type: e.type,
        paymentFlow: e.paymentFlow,
        paymentTermAnchor: e.paymentTermAnchor,
        paymentTermDays: e.paymentTermDays,
        tags: e.tags,
        comments: e.comments,
      }}
    />
  );
}
