// controllers/family.controller.js
import { Op } from "sequelize";
import { User } from "../models/UserModel.js";

/**
 * ADMIN: listar estudiantes (opcional: solo sin padre)
 * GET /api/admin/students?withoutParent=1&search=
 */
export const adminListStudents = async (req, res) => {
  try {
    const withoutParent = String(req.query.withoutParent || "0") === "1";
    const search = String(req.query.search || "").trim();

    const where = {
      role: "ESTUDIANTE",
      ...(withoutParent ? { parent_id: null } : {}),
      ...(search
        ? {
            [Op.or]: [
              { name: { [Op.like]: `%${search}%` } },
              { email: { [Op.like]: `%${search}%` } },
            ],
          }
        : {}),
    };

    const students = await User.findAll({
      where,
      attributes: [
  "id",
  "name",
  "email",
  "status",
  "parent_id",
  "grade",
  "section"
],
      order: [["name", "ASC"]],
      limit: 500,
    });

    return res.json(students);
  } catch (error) {
    console.error("adminListStudents:", error);
    return res.status(500).json({ message: "Error al listar estudiantes", error: error.message });
  }
};

/**
 * ADMIN: asignar hijos a un padre (en masa)
 * PATCH /api/admin/parents/:parentId/children
 * body: { student_ids: [1,2,3], onlyUnassigned?: true }
 */
/**
 * ADMIN: asignar hijos a un padre (REEMPLAZA)
 * PATCH /api/admin/parents/:parentId/children
 * body: { student_ids: [1,2,3], onlyUnassigned?: true }
 */
export const adminAssignChildrenToParent = async (req, res) => {
  try {
    const parentId = Number(req.params.parentId);
    const { student_ids, onlyUnassigned } = req.body;

    if (!parentId || Number.isNaN(parentId)) {
      return res.status(400).json({ message: "parentId inválido" });
    }

    if (!Array.isArray(student_ids)) {
      return res.status(400).json({ message: "student_ids debe ser un arreglo" });
    }

    // Normaliza: ids únicos y numéricos
    const ids = [...new Set(student_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))];

    const parent = await User.findByPk(parentId, {
      attributes: ["id", "name", "email", "role"],
    });
    if (!parent) return res.status(404).json({ message: "Padre no encontrado" });
    if (parent.role !== "PADRE") return res.status(400).json({ message: "El usuario no es PADRE" });

    // 1) Validar que los ids enviados (si hay) existan y sean estudiantes
    if (ids.length > 0) {
      const students = await User.findAll({
        where: { id: ids },
        attributes: ["id", "role", "parent_id"],
      });

      if (students.length !== ids.length) {
        return res.status(400).json({ message: "Uno o más student_ids no existen" });
      }

      for (const st of students) {
        if (st.role !== "ESTUDIANTE") {
          return res.status(400).json({ message: `El usuario ${st.id} no es ESTUDIANTE` });
        }
      }

      // Si onlyUnassigned=true, no permitas asignar estudiantes que ya tienen padre (y no sean este padre)
      if (String(onlyUnassigned || "false") === "true") {
        const stolen = students.filter((s) => s.parent_id !== null && Number(s.parent_id) !== parentId);
        if (stolen.length > 0) {
          return res.status(400).json({
            message: "Hay estudiantes que ya tienen representante",
            students: stolen.map((s) => s.id),
          });
        }
      }
    }

    // 2) DESASIGNAR: a todos los estudiantes que actualmente pertenecen a este padre
    //    pero que ya NO están en la lista ids
    const [removed] = await User.update(
      { parent_id: null },
      {
        where: {
          role: "ESTUDIANTE",
          parent_id: parentId,
          ...(ids.length > 0 ? { id: { [Op.notIn]: ids } } : {}), // si ids viene vacío, quita a todos
        },
      }
    );

    // Si ids viene vacío => ya quedó (padre sin hijos)
    let added = 0;

    // 3) ASIGNAR: los ids seleccionados (si hay)
    if (ids.length > 0) {
      const whereUpdate = {
        id: ids,
        role: "ESTUDIANTE",
        ...(String(onlyUnassigned || "false") === "true" ? { [Op.or]: [{ parent_id: null }, { parent_id: parentId }] } : {}),
      };

      const [affected] = await User.update({ parent_id: parentId }, { where: whereUpdate });
      added = affected;
    }

    // 4) devolver hijos finales
    const children = await User.findAll({
      where: { role: "ESTUDIANTE", parent_id: parentId },
      attributes: ["id", "name", "email", "status", "parent_id", "grade", "section"],
      order: [["name", "ASC"]],
    });

    return res.json({
      message: "Asignación actualizada (reemplazo)",
      parent,
      removed,
      added,
      children,
    });
  } catch (error) {
    console.error("adminAssignChildrenToParent:", error);
    return res.status(500).json({ message: "Error al asignar hijos", error: error.message });
  }
};

/**
 * PADRE: ver mis hijos
 * GET /api/parent/my-children
 */
export const parentMyChildren = async (req, res) => {
  try {
    const parentId = req.user?.id;

    const children = await User.findAll({
      where: { role: "ESTUDIANTE", parent_id: parentId },
      attributes: [
        "id",
        "name",
        "email",
        "status",
        "parent_id",
        "grade",
        "section",
      ],
      order: [["name", "ASC"]],
    });

    return res.json(children);
  } catch (error) {
    console.error("parentMyChildren:", error);
    return res.status(500).json({
      message: "Error al obtener hijos",
      error: error.message,
    });
  }
};
/**
 * ADMIN: obtener hijos asignados a un padre
 * GET /api/admin/parents/:parentId/children
 */
export const adminGetParentChildren = async (req, res) => {
  try {
    const parentId = Number(req.params.parentId);

    if (!parentId || Number.isNaN(parentId)) {
      return res.status(400).json({ message: "parentId inválido" });
    }

    const parent = await User.findByPk(parentId, {
      attributes: ["id", "name", "email", "role"],
    });

    if (!parent) return res.status(404).json({ message: "Padre no encontrado" });
    if (parent.role !== "PADRE") {
      return res.status(400).json({ message: "El usuario no es PADRE" });
    }

    const children = await User.findAll({
      where: { role: "ESTUDIANTE", parent_id: parentId },
      attributes: ["id", "name", "email", "status", "parent_id", "grade", "section"],
      order: [["name", "ASC"]],
    });

    return res.json({
      parentId,
      children,
    });
  } catch (error) {
    console.error("adminGetParentChildren:", error);
    return res.status(500).json({
      message: "Error al obtener hijos del padre",
      error: error.message,
    });
  }
};