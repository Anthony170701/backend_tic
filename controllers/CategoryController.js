import { Category } from "../models/CategoryModel.js";
import { Dish } from "../models/DishModel.js";

export const getCategories = async (req, res) => {
  try {
    const rows = await Category.findAll({
      where: { is_active: true },
      order: [["name", "ASC"]],
    });
    res.json(rows);
  } catch (error) {
    console.error("Error al listar categorías:", error);
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "name requerido" });
    }

    const row = await Category.create({
      name: name.trim(),
      description: description?.trim() || null,
    });

    res.status(201).json(row);
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ message: "No se pudo crear la categoría" });
  }
};

// ✅ GET /api/categories/with-dishes
export const getCategoriesWithDishes = async (req, res) => {
  try {
    const rows = await Category.findAll({
      where: { is_active: true },
      order: [["name", "ASC"]],
      include: [
        {
          model: Dish,
          as: "dishes",              // ✅ IMPORTANTE
          required: false,           // ✅ devuelve categoría aunque no tenga platos
          where: { is_active: true },// ✅ solo platos activos
        },
      ],
    });

    // Opcional: ordenar platos dentro por nombre
    const data = rows.map((c) => {
      const json = c.toJSON();
      if (Array.isArray(json.dishes)) {
        json.dishes.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      }
      return json;
    });

    res.json(data);
  } catch (error) {
    console.error("Error al obtener categorías con platos:", error);
    res.status(500).json({ message: "Error al obtener categorías con platos" });
  }
};
