// router/parentRouter.js
import { Router } from "express";
import { verifyToken, checkRole } from "../middleware/auth.js";
import { getMyStudents } from "../controllers/ParentController.js";

export const parentRouter = Router();

/**
 * GET /api/parent/students
 * PADRE obtiene sus estudiantes
 */
parentRouter.get(
  "/students",
  verifyToken,
  checkRole("PADRE", "PARENT", "ADMIN"),
  getMyStudents
);
