-- Phase 8: advisory time accepts fractional minutes (e.g. 0.5)

ALTER TABLE "Test"
  ALTER COLUMN "advisoryTimeMin" SET DATA TYPE DOUBLE PRECISION;
