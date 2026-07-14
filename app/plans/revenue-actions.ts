"use server";

// Revenue assumption screen — data + persistence (Gate 1: RevenueAnnual only).
// Writes are keyed (PlanVersion × Client × Year). Seasonality is added in Gate 3.

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";

export type RevenueClient = {
  entityId: string;
  name: string;
  revenueByYear: Record<number, number>; // calendar year -> amount
};

// Clients already attached to this PlanVersion (via RevenueAnnual), with their revenue.
export async function getRevenueData(
  planVersionId: string,
): Promise<{ clients: RevenueClient[] }> {
  const rows = await prisma.revenueAnnual.findMany({
    where: { planVersionId },
    include: { client: { select: { id: true, name: true } } },
    orderBy: [{ clientId: "asc" }, { year: "asc" }],
  });
  const byClient = new Map<string, RevenueClient>();
  for (const r of rows) {
    let c = byClient.get(r.clientId);
    if (!c) {
      c = { entityId: r.clientId, name: r.client.name ?? "(unnamed)", revenueByYear: {} };
      byClient.set(r.clientId, c);
    }
    c.revenueByYear[r.year] = Number(r.amount);
  }
  return { clients: [...byClient.values()] };
}

export type SaveRevenueResult = { ok: true } | { ok: false; error: string };

// Idempotent rewrite of this version's RevenueAnnual from the table state
// (rule-E style: delete + recreate in one transaction).
export async function saveRevenue(
  planVersionId: string,
  clients: { entityId: string; revenueByYear: Record<number, number> }[],
): Promise<SaveRevenueResult> {
  const rows = clients.flatMap((c) =>
    Object.entries(c.revenueByYear).map(([year, amount]) => ({
      planVersionId,
      clientId: c.entityId,
      year: Number(year),
      amount: Number.isFinite(amount) ? amount : 0,
    })),
  );
  await prisma.$transaction([
    prisma.revenueAnnual.deleteMany({ where: { planVersionId } }),
    prisma.revenueAnnual.createMany({ data: rows }),
  ]);
  revalidatePath("/plans");
  return { ok: true };
}
