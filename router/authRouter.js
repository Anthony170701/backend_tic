import express from "express";
import { register, login, changePassword } from "../controllers/authController.js";
import { verifyToken, checkRole } from "../middleware/auth.js";

export const routerAuth = express.Router();

// 🔐 Login (PÚBLICO)
routerAuth.post("/login", login);

// 🔐 Cambiar contraseña (USUARIO AUTENTICADO)
routerAuth.put("/change-password", verifyToken, changePassword);

// 🔐 Crear usuario (SOLO ADMIN / DIRECTORA)
routerAuth.post(
  "/register",
  verifyToken,
  checkRole("ADMIN"), // 👈 solo la directora
  register
);
