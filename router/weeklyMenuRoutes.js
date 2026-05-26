import { Router } from "express";
import { verifyToken, checkRole } from "../middleware/auth.js";

import {
  getActivePublishedMenu,
  getLatestDraftMenu,
  recyclePreviousToDraft,
  publishDraftMenu,
  getNextPublishedMenu,
  deleteWeeklyMenuItem,
  updateWeeklyMenuItemSnapshot,

  // ✅ NUEVOS
  createDraftMenuForWeek,
  addWeeklyMenuItem,
} from "../controllers/WeeklyMenuController.js";

export const weeklyMenuRoutes = Router();

// -----------------------------
// MENÚS
// -----------------------------
weeklyMenuRoutes.get("/weekly-menus/active", verifyToken, getActivePublishedMenu);

weeklyMenuRoutes.get(
  "/weekly-menus/draft/latest",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  getLatestDraftMenu
);

weeklyMenuRoutes.get(
  "/weekly-menus/published/next",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  getNextPublishedMenu
);

weeklyMenuRoutes.post(
  "/weekly-menus/draft/recycle-previous",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  recyclePreviousToDraft
);

// ✅ BOOTSTRAP: crear primer borrador aunque no haya nada
weeklyMenuRoutes.post(
  "/weekly-menus/draft/create",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  createDraftMenuForWeek
);

weeklyMenuRoutes.post(
  "/weekly-menus/:id/publish",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  publishDraftMenu
);

// -----------------------------
// ITEMS (por día)
// -----------------------------

// ✅ crear item (cuando el día está vacío)
weeklyMenuRoutes.post(
  "/weekly-menu-items",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  addWeeklyMenuItem
);

weeklyMenuRoutes.put(
  "/weekly-menu-items/:id",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  updateWeeklyMenuItemSnapshot
);

weeklyMenuRoutes.delete(
  "/weekly-menu-items/:id",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  deleteWeeklyMenuItem
);
