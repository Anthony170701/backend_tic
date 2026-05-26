import express from "express";
import { verifyToken, checkRole } from "../middleware/auth.js";
import {
  getPendingByStudentCode,
  deliverOrder,
  deliverAllTodayByStudentCode,
} from "../controllers/barController.js";

const router = express.Router();

router.get(
  "/student/:code/pending",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  getPendingByStudentCode
);

router.post(
  "/orders/:id/deliver",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  deliverOrder
);

router.post(
  "/student/:code/deliver-all",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  deliverAllTodayByStudentCode
);

export default router;