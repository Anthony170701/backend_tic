import { Router } from "express";
import {
  getAdminStats,
  getRecentOrders,
  getPendingPayments,
} from "../controllers/adminDashboardController.js";

const router = Router();

router.get("/stats", getAdminStats);
router.get("/orders/recent", getRecentOrders);
router.get("/payments/pending", getPendingPayments);

export default router;