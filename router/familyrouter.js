// routes/family.routes.js
import { Router } from "express";
import { verifyToken, checkRole } from "../middleware/auth.js";
import {
  adminListStudents,
  adminAssignChildrenToParent,
  adminGetParentChildren, // ✅ NUEVO
  parentMyChildren,
} from "../controllers/familyController.js";

const router = Router();

// ADMIN
router.get("/admin/students", verifyToken, checkRole("ADMIN"), adminListStudents);
router.get("/admin/parents/:parentId/children", verifyToken, checkRole("ADMIN"), adminGetParentChildren); // ✅ NUEVO
router.patch("/admin/parents/:parentId/children", verifyToken, checkRole("ADMIN"), adminAssignChildrenToParent);

// PADRE
router.get("/parent/my-children", verifyToken, checkRole("PADRE"), parentMyChildren);

export default router;