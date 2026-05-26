import bcrypt from "bcrypt";
import { User } from "../models/UserModel.js";

// ===============================
// LISTAR
// ===============================
export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "name",
        "email",
        "role",
        "status",
        "must_change_password",
      ],
      order: [["id", "DESC"]],
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error obteniendo usuarios" });
  }
};

// ===============================
// EDITAR
// ===============================
export const updateUser = async (req, res) => {
  try {
    const id = req.params.id;

    const {
      name,
      email,
      role,
      status,
      reset_password,
      grade,
      section,
    } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    // Normaliza role (si viene)
    const nextRole = role !== undefined && role !== null ? String(role).trim().toUpperCase() : undefined;

    // evitar email repetido
    if (email && String(email).trim().toLowerCase() !== String(user.email).toLowerCase()) {
      const nextEmail = String(email).trim().toLowerCase();

      const exists = await User.findOne({ where: { email: nextEmail } });
      if (exists) {
        return res.status(400).json({ message: "El email ya está en uso" });
      }
      user.email = nextEmail;
    }

    if (name !== undefined) user.name = String(name).trim();
    if (nextRole !== undefined) user.role = nextRole;
    if (status !== undefined) user.status = String(status).trim();

    // ✅ grade/section SOLO si el usuario queda como ESTUDIANTE
    const finalRole = String(user.role || "").toUpperCase();

    if (finalRole === "ESTUDIANTE") {
      if (grade !== undefined) {
        const g = String(grade ?? "").trim();
        user.grade = g ? g : null;
      }

      if (section !== undefined) {
        const s = String(section ?? "").trim();
        user.section = s ? s : null;
      }
    } else {
      // ✅ opcional: si ya no es estudiante, limpia
      user.grade = null;
      user.section = null;
    }

    // reset de contraseña opcional
    if (reset_password && String(reset_password).trim().length >= 6) {
      user.password_hash = await bcrypt.hash(String(reset_password).trim(), 10);
      user.must_change_password = 1;
    }

    await user.save();

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error actualizando usuario" });
  }
};

// ===============================
// ELIMINAR (SOFT)
// ===============================
export const deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    if (user.role === "ADMIN") {
      return res.status(400).json({ message: "No puedes eliminar un ADMIN" });
    }

    user.status = "inactive";
    await user.save();

    res.json({ message: "Usuario desactivado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error eliminando usuario" });
  }
};
