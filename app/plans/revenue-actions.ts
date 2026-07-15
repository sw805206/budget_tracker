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

export type ClientOption = { id: string; name: string };

// Clients already attached to this PlanVersion (via RevenueAnnual) with their revenue,
// plus the ACTIVE client-entity list for the combobox. BL-014: archived entities
// (archivedAt != null) are excluded — reusing the PR#6 archived seam.
export async function getRevenueData(
  planVersionId: string,
): Promise<{ clients: RevenueClient[]; activeClients: ClientOption[] }> {
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
  const active = await prisma.entity.findMany({
    where: { archivedAt: null, type: "client" }, // BL-014: archived excluded
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return {
    clients: [...byClient.values()],
    activeClients: active.map((a) => ({ id: a.id, name: a.name ?? "(unnamed)" })),
  };
}

// Inline entity creation from the revenue tab: name only + fixed defaults.
// Type=client (this is the revenue tab), Payment Flow=AR, Payment Term=Statement+30,
// Currency=USD. May be "incomplete" is fine — the compute-gate catches it at Results.
export async function createRevenueClient(
  name: string,
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const n = name.trim();
  if (!n) return { ok: false, error: "Name is required." };
  const e = await prisma.entity.create({
    data: {
      name: n,
      type: "client",
      paymentFlow: "AR",
      paymentTermAnchor: "Statement",
      paymentTermDays: 30,
      currency: "USD",
    },
  });
  revalidatePath("/entities");
  return { ok: true, id: e.id, name: n };
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
