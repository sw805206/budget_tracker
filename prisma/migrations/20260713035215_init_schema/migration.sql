-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowRef" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "subgroup" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "approach" TEXT NOT NULL DEFAULT 'top-down',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanStepSelection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    CONSTRAINT "PlanStepSelection_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "planOfRecord" BOOLEAN NOT NULL DEFAULT false,
    "whatChangedNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "startMonth" TEXT NOT NULL,
    "horizonX" INTEGER NOT NULL DEFAULT 3,
    "bucket" TEXT NOT NULL DEFAULT 'monthly',
    "beginningCash" DECIMAL NOT NULL DEFAULT 0,
    "targetCashValue" DECIMAL NOT NULL DEFAULT 0,
    "targetCashMode" TEXT NOT NULL DEFAULT 'dollars',
    CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanVersionAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "percentage" DECIMAL NOT NULL,
    CONSTRAINT "PlanVersionAllocation_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RevenueAnnual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    CONSTRAINT "RevenueAnnual_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RevenueAnnual_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonalityWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "weight" DECIMAL NOT NULL,
    CONSTRAINT "SeasonalityWeight_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SeasonalityWeight_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT,
    "operationalStep" TEXT NOT NULL,
    "vendorId" TEXT,
    "timingType" TEXT NOT NULL,
    "startMonth" TEXT,
    "endMonth" TEXT,
    "uom" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    CONSTRAINT "CostLine_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Entity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentFlow" TEXT NOT NULL,
    "paymentTermAnchor" TEXT NOT NULL DEFAULT 'Statement',
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "mappedID" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "entityInfo" TEXT,
    "tags" TEXT,
    "internalPOC" TEXT,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutputRevenueMonthly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    CONSTRAINT "OutputRevenueMonthly_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutputRevenueMonthly_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutputCostMonthly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planVersionId" TEXT NOT NULL,
    "costLineId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    CONSTRAINT "OutputCostMonthly_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutputCostMonthly_costLineId_fkey" FOREIGN KEY ("costLineId") REFERENCES "CostLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlanStepSelection_planId_idx" ON "PlanStepSelection"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanStepSelection_planId_step_option_key" ON "PlanStepSelection"("planId", "step", "option");

-- CreateIndex
CREATE INDEX "PlanVersion_planId_idx" ON "PlanVersion"("planId");

-- CreateIndex
CREATE INDEX "PlanVersionAllocation_planVersionId_idx" ON "PlanVersionAllocation"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersionAllocation_planVersionId_step_flow_key" ON "PlanVersionAllocation"("planVersionId", "step", "flow");

-- CreateIndex
CREATE INDEX "RevenueAnnual_planVersionId_idx" ON "RevenueAnnual"("planVersionId");

-- CreateIndex
CREATE INDEX "RevenueAnnual_clientId_idx" ON "RevenueAnnual"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueAnnual_planVersionId_clientId_year_key" ON "RevenueAnnual"("planVersionId", "clientId", "year");

-- CreateIndex
CREATE INDEX "SeasonalityWeight_planVersionId_idx" ON "SeasonalityWeight"("planVersionId");

-- CreateIndex
CREATE INDEX "SeasonalityWeight_clientId_idx" ON "SeasonalityWeight"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonalityWeight_planVersionId_clientId_month_key" ON "SeasonalityWeight"("planVersionId", "clientId", "month");

-- CreateIndex
CREATE INDEX "CostLine_planVersionId_idx" ON "CostLine"("planVersionId");

-- CreateIndex
CREATE INDEX "CostLine_vendorId_idx" ON "CostLine"("vendorId");

-- CreateIndex
CREATE INDEX "OutputRevenueMonthly_planVersionId_idx" ON "OutputRevenueMonthly"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "OutputRevenueMonthly_planVersionId_clientId_month_key" ON "OutputRevenueMonthly"("planVersionId", "clientId", "month");

-- CreateIndex
CREATE INDEX "OutputCostMonthly_planVersionId_idx" ON "OutputCostMonthly"("planVersionId");

-- CreateIndex
CREATE INDEX "OutputCostMonthly_costLineId_idx" ON "OutputCostMonthly"("costLineId");

-- CreateIndex
CREATE UNIQUE INDEX "OutputCostMonthly_costLineId_month_key" ON "OutputCostMonthly"("costLineId", "month");
