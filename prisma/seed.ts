// Dev/test seed — lights up every state of the Entity screen (referenced by
// Published only / Draft only / both, unreferenced, and the vendor SET-NULL path).
// It is NOT a realistic budget: the plan side is minimal-but-valid, just enough to
// create valid Entity references.
//
// IDENTIFIABLE + IDEMPOTENT (wipe-tagged-then-reseed):
//   - Seeded entities carry the tag "seed".
//   - Seeded plans are marked by a "SEED-" prefix on their PlanVersion name
//     (Plan has no name column) and a "SEED " customer.
//   - On every run we first delete ONLY seed data (in FK-safe order), then recreate.
//     Untagged / real data is never touched.
//
// Run: `npx prisma db seed`  (wired via prisma.config.ts → migrations.seed = "tsx prisma/seed.ts")

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

// ── Teardown: remove ONLY seed data, references first (RESTRICT-safe) ──────────
async function wipeSeedData() {
  // Seeded plans are identified by their PlanVersion name prefix "SEED-".
  const seededVersions = await prisma.planVersion.findMany({
    where: { name: { startsWith: "SEED-" } },
    select: { id: true, planId: true },
  });
  const versionIds = seededVersions.map((v) => v.id);
  const planIds = [...new Set(seededVersions.map((v) => v.planId))];

  // 1) reference / child rows that point at entities or hang off seeded versions
  await prisma.revenueAnnual.deleteMany({ where: { planVersionId: { in: versionIds } } });
  await prisma.seasonalityWeight.deleteMany({ where: { planVersionId: { in: versionIds } } });
  await prisma.outputRevenueMonthly.deleteMany({ where: { planVersionId: { in: versionIds } } });
  await prisma.costLine.deleteMany({ where: { planVersionId: { in: versionIds } } });
  await prisma.planVersionAllocation.deleteMany({ where: { planVersionId: { in: versionIds } } });
  await prisma.planStepSelection.deleteMany({ where: { planId: { in: planIds } } });
  // 2) versions, then plans
  await prisma.planVersion.deleteMany({ where: { id: { in: versionIds } } });
  await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
  // 3) seeded entities (now unreferenced) — tag "seed"
  await prisma.entity.deleteMany({ where: { tags: { contains: "seed" } } });
}

// ── Create ────────────────────────────────────────────────────────────────────
async function seed() {
  // Entities — all mandatory fields complete, all tagged "seed".
  const entity = (
    name: string,
    type: string,
    paymentFlow: string,
  ) =>
    prisma.entity.create({
      data: {
        name,
        type,
        paymentFlow,
        paymentTermAnchor: "Statement",
        paymentTermDays: 30,
        currency: "USD",
        tags: "seed",
      },
    });

  // clients
  const northwind = await entity("SEED Northwind Logistics", "client", "AR"); // Published only
  const contoso = await entity("SEED Contoso Freight", "client", "AR"); //      Draft only
  const globex = await entity("SEED Globex Distribution", "client", "AR"); //   BOTH
  // vendors
  const fabrikam = await entity("SEED Fabrikam Fuel", "vendor", "AP"); //       vendor path (CostLine)
  const adatum = await entity("SEED Adatum Packaging", "vendor", "AP"); //      UNREFERENCED
  // another type
  const portAuth = await entity("SEED Port Authority", "government", "Passthrough"); // UNREFERENCED

  // Minimal-but-valid plans. Plan has no name column, so the "SEED-" marker lives
  // on the PlanVersion name; customer also carries "SEED " for visibility.
  // Plan + its PlanVersion are created ATOMICALLY (one nested create) — there is no
  // window where a Plan could exist without its SEED- version, which teardown keys
  // off; so a crash can't orphan a Plan beyond the reach of the next reseed's wipe.
  const planWithVersion = async (
    customer: string,
    versionName: string,
    status: string,
  ) => {
    const p = await prisma.plan.create({
      data: {
        workflowRef: "WF-001",
        industry: "Logistics",
        group: "Warehousing",
        subgroup: "Fulfillment Center",
        customer,
        versions: {
          create: { name: versionName, startMonth: "2026-01", status },
        },
      },
      include: { versions: true },
    });
    return p.versions[0];
  };

  const pubVersion = await planWithVersion(
    "SEED Freight Co (Published)",
    "SEED-PUB-2026",
    "Published",
  );
  const draftVersion = await planWithVersion(
    "SEED Freight Co (Draft)",
    "SEED-DRAFT-2026",
    "Draft",
  );

  // References (client → RevenueAnnual; vendor → CostLine).
  // Published: Northwind + Globex (client), Fabrikam (vendor).
  await prisma.revenueAnnual.create({
    data: { planVersionId: pubVersion.id, clientId: northwind.id, year: 2026, amount: 250000 },
  });
  await prisma.revenueAnnual.create({
    data: { planVersionId: pubVersion.id, clientId: globex.id, year: 2026, amount: 180000 },
  });
  await prisma.costLine.create({
    data: {
      planVersionId: pubVersion.id,
      description: "Fuel — long-haul",
      category: "COGS",
      operationalStep: "Delivery",
      timingType: "monthly",
      startMonth: "2026-01",
      endMonth: "2026-12",
      uom: "DOLLAR",
      value: 6000,
      vendorId: fabrikam.id,
    },
  });

  // Draft: Contoso + Globex (client).
  await prisma.revenueAnnual.create({
    data: { planVersionId: draftVersion.id, clientId: contoso.id, year: 2026, amount: 90000 },
  });
  await prisma.revenueAnnual.create({
    data: { planVersionId: draftVersion.id, clientId: globex.id, year: 2026, amount: 95000 },
  });

  return { northwind, contoso, globex, fabrikam, adatum, portAuth };
}

async function main() {
  console.log("Wiping existing seed data (tag=seed / SEED- plans)…");
  await wipeSeedData();
  console.log("Seeding…");
  const e = await seed();
  console.log("Seed complete. Entities created:");
  for (const [k, v] of Object.entries(e)) {
    console.log(`  ${v.name} (${v.type}) — id ${v.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
