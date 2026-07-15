"use server";

// Revenue assumption screen — data + persistence (Gate 1: RevenueAnnual only).
// Writes are keyed (PlanVersion × Client × Year). Seasonality is added in Gate 3.

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";

export type RevenueClient = {
  entityId: string;
  name: string;
  revenueByYear: Record<number, number>; // calendar year -> amount
  seasonalityByMonth: Record<number, number>; // month 1..12 -> weight
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
      c = {
        entityId: r.clientId,
        name: r.client.name ?? "(unnamed)",
        revenueByYear: {},
        seasonalityByMonth: {},
      };
      byClient.set(r.clientId, c);
    }
    c.revenueByYear[r.year] = Number(r.amount);
  }
  const seasons = await prisma.seasonalityWeight.findMany({ where: { planVersionId } });
  for (const s of seasons) {
    const c = byClient.get(s.clientId);
    if (c) c.seasonalityByMonth[s.month] = Number(s.weight);
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

// Remove clients from THIS PlanVersion only — one transactional delete of their
// RevenueAnnual + SeasonalityWeight rows (not N sequential). Entities are NOT
// touched: Master Data owns entity lifecycle (PR#6).
export async function deleteClients(
  planVersionId: string,
  clientIds: string[],
): Promise<SaveRevenueResult> {
  if (clientIds.length === 0) return { ok: true };
  await prisma.$transaction([
    prisma.revenueAnnual.deleteMany({ where: { planVersionId, clientId: { in: clientIds } } }),
    prisma.seasonalityWeight.deleteMany({ where: { planVersionId, clientId: { in: clientIds } } }),
  ]);
  revalidatePath("/plans");
  return { ok: true };
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

const JAN_NOV = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Idempotent rewrite of this version's RevenueAnnual + SeasonalityWeight from the
// table state (rule-E style: delete + recreate in one transaction). Seasonality is
// passed as Jan–Nov weights; Dec is derived here = 100 − sum(Jan:Nov). A curve whose
// Jan–Nov exceeds 100 (Dec would be negative) is rejected — the server backstop for
// the client-side negative-remainder block.
export async function saveRevenue(
  planVersionId: string,
  clients: {
    entityId: string;
    revenueByYear: Record<number, number>;
    seasonality: Record<number, number>; // months 1..11
  }[],
): Promise<SaveRevenueResult> {
  const revRows = clients.flatMap((c) =>
    Object.entries(c.revenueByYear).map(([year, amount]) => ({
      planVersionId,
      clientId: c.entityId,
      year: Number(year),
      amount: Number.isFinite(amount) ? amount : 0,
    })),
  );

  const seasRows: {
    planVersionId: string;
    clientId: string;
    month: number;
    weight: number;
  }[] = [];
  for (const c of clients) {
    const janNov = JAN_NOV.map((m) => Number(c.seasonality[m]) || 0);
    const dec = 100 - janNov.reduce((a, b) => a + b, 0);
    if (dec < 0)
      return { ok: false, error: "A seasonality curve exceeds 100% (December would be negative)." };
    JAN_NOV.forEach((m, i) =>
      seasRows.push({ planVersionId, clientId: c.entityId, month: m, weight: janNov[i] }),
    );
    seasRows.push({ planVersionId, clientId: c.entityId, month: 12, weight: dec });
  }

  await prisma.$transaction([
    prisma.revenueAnnual.deleteMany({ where: { planVersionId } }),
    prisma.revenueAnnual.createMany({ data: revRows }),
    prisma.seasonalityWeight.deleteMany({ where: { planVersionId } }),
    prisma.seasonalityWeight.createMany({ data: seasRows }),
  ]);
  revalidatePath("/plans");
  return { ok: true };
}
