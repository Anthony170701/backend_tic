import express from "express";
import { verifyToken, checkRole } from "../middleware/auth.js"; // o verifyToken.js si así se llama
import { getProfile, updateProfile, getAllUsers, filterUsers } from "../controllers/UserController.js";

export const routerUser = express.Router();

// Perfil propio o por id
routerUser.get("/users/me", verifyToken, getProfile);
routerUser.get("/users/:id", verifyToken, checkRole("ADMIN","BAR"), getProfile);

// Actualizar mi perfil
routerUser.put("/users/me", verifyToken, updateProfile);

// Listado y filtro (protege si quieres)
routerUser.get("/users", verifyToken, checkRole("ADMIN"), getAllUsers);
routerUser.get("/users/filter", verifyToken, checkRole("ADMIN"), filterUsers);
routerUser.get("/users/:id", verifyToken, checkRole("ADMIN"), getProfile);

