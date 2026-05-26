import { Router } from "express";
import {
  getCategories,
  createCategory,
  getCategoriesWithDishes,
} from "../controllers/CategoryController.js";
// import { verifyToken } from "../middleware/authMiddleware.js";
// import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Para el padre (público con token, según tu sistema)
router.get("/with-dishes", getCategoriesWithDishes);

// Para administración
router.get("/", getCategories);
router.post("/", createCategory);

export default router;
