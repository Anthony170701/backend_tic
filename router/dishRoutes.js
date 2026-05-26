import { Router } from "express";
import { verifyToken, checkRole } from "../middleware/auth.js";
import {
  listDishes,
  createDish,
  updateDish,
  deleteDish,
} from "../controllers/DishController.js";
import { uploadToMemory } from "../middleware/uploadMiddleware.js";

export const dishRoutes = Router();

// LISTAR (bar, padres, estudiantes, admin)
dishRoutes.get("/dishes", verifyToken, listDishes);

// CREAR con imagen (solo BAR y ADMIN)
dishRoutes.post(
  "/dishes",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  uploadToMemory.single("image"),
  createDish
);

// ACTUALIZAR
dishRoutes.put(
  "/dishes/:id",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  uploadToMemory.single("image"),
  updateDish
);

// DESACTIVAR
dishRoutes.delete(
  "/dishes/:id",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  deleteDish
);
