// controllers/ParentController.js
import { ParentProfile } from "../models/ParentProfileModel.js";
import { SchoolStudent } from "../models/SchoolStudentModel.js";

export const getMyStudents = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const parent = await ParentProfile.findOne({
      where: { user_id: userId },
      attributes: ["id", "user_id"],
    });

    if (!parent) {
      return res.status(404).json({ message: "Este usuario no tiene perfil de padre" });
    }

    const students = await SchoolStudent.findAll({
      where: { parent_id: parent.id },
      attributes: ["id", "name", "grade", "section"],
      order: [["id", "ASC"]],
    });

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener estudiantes", error: error.message });
  }
};
