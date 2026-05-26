import jwt from "jsonwebtoken";
import { User } from "../models/UserModel.js";

export const verifyToken = async (req, res, next) => {
  try {
    const bearerHeader = req.headers.authorization;

    if (!bearerHeader) {
      return res.status(401).json({ message: "No se proporcionó token de acceso" });
    }

    if (!bearerHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Formato de token inválido" });
    }

    const token = bearerHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "clave_secreta");

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    if (user.status !== "active") {
      return res.status(401).json({ message: "Usuario inactivo" });
    }

    // ✅ ROL EXACTO DE BD (SIN TRADUCIR)
    const role = String(user.role || "").toUpperCase();

    req.user = {
      id: user.id,
      email: user.email,
      role,
    };

    next();
  } catch (error) {
    console.error("Error en verificación de token:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Token inválido" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado" });
    }

    return res.status(401).json({
      message: "Error en la autenticación",
      error: error.message,
    });
  }
};

export const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const userRole = String(req.user.role || "").toUpperCase();
    const allowedRoles = roles.map((r) => String(r).toUpperCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "No tienes permisos para realizar esta acción" });
    }

    next();
  };
};
