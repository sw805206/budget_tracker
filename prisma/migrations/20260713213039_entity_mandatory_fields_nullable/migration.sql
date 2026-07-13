-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "type" TEXT,
    "paymentFlow" TEXT,
    "paymentTermAnchor" TEXT,
    "paymentTermDays" INTEGER,
    "mappedID" TEXT,
    "currency" TEXT DEFAULT 'USD',
    "entityInfo" TEXT,
    "tags" TEXT,
    "internalPOC" TEXT,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Entity" ("comments", "createdAt", "currency", "entityInfo", "id", "internalPOC", "mappedID", "name", "paymentFlow", "paymentTermAnchor", "paymentTermDays", "tags", "type", "updatedAt") SELECT "comments", "createdAt", "currency", "entityInfo", "id", "internalPOC", "mappedID", "name", "paymentFlow", "paymentTermAnchor", "paymentTermDays", "tags", "type", "updatedAt" FROM "Entity";
DROP TABLE "Entity";
ALTER TABLE "new_Entity" RENAME TO "Entity";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
