import { Router } from "express";
import {
  reportSalesByDateRange,
  reportWeeklyBars,
  reportTopProducts,
  reportGradeDistribution,
  exportAllCsv,
} from "../controllers/adminReportController.js";

const router = Router();

router.get("/sales", reportSalesByDateRange);
router.get("/weekly-bars", reportWeeklyBars);
router.get("/top-products", reportTopProducts);
router.get("/grade-distribution", reportGradeDistribution);

// ✅ IMPORTANTE: aquí SOLO /export-all
router.get("/export-all", exportAllCsv);

export default router;