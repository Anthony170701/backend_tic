// controllers/UserController.js
import { Op } from "sequelize";
import { User } from "../models/UserModel.js";

// Obtener mi perfil (desde el token) o por :id si se envía
export const getProfile = async (req, res) => {
  try {
    const idParam = req.params?.id ? Number(req.params.id) : null;
    const userId = idParam || req.user?.id;

    if (!userId) return res.status(400).json({ message: "Falta id de usuario" });

    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password_hash"] },
    });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener perfil", error: error.message });
  }
};

// Actualizar datos básicos del perfil (solo su propio perfil)
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    // Solo permitimos editar estos campos básicos
    const { name, email } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    await user.update({
      name: name ?? user.name,
      email: email ?? user.email,
    });

    res.json({ message: "Perfil actualizado", user });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar perfil", error: error.message });
  }
};

// Listar usuarios (ADMIN/BAR si quieres) con paginación
export const getAllUsers = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    const { rows, count } = await User.findAndCountAll({
      attributes: { exclude: ["password_hash"] },
      order: [["id", "DESC"]],
      limit,
      offset,
    });

    res.json({
      users: rows,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuarios", error: error.message });
  }
};

// Filtro simple por role, status y texto (name o email)
export const filterUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ["password_hash"] },
      order: [["id", "DESC"]],
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error al filtrar usuarios", error: error.message });
  }
};
