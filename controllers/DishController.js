import { Op } from "sequelize";
import path from "path";
import { sequelize } from "../db/conexion.js";

import { Dish } from "../models/DishModel.js";
import { Category } from "../models/CategoryModel.js";
import { WeeklyMenu } from "../models/WeeklyMenuModel.js";
import { WeeklyMenuItem } from "../models/WeeklyMenuItemModel.js";

import { saveFileFromMemory } from "../middleware/uploadMiddleware.js";

// ==============================
// Helpers
// ==============================
const isValidDateOnly = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const normalizeDateOnly = (value) => {
  if (!value) return null;
  return String(value).slice(0, 10);
};

const addDaysToISO = (isoDate, add) => {
  const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + add);

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const todayISO = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ✅ Permite editar si:
// - DRAFT (siempre)
// - PUBLISHED FUTURO o VIGENTE (hoy <= week_end)
// ❌ No editable si ya pasó esa semana (hoy > week_end)
const isFutureOrCurrentWeek = (weekStartISO) => {
  const today = todayISO();
  const ws = normalizeDateOnly(weekStartISO);
  if (!ws || !isValidDateOnly(ws)) return false;
  // permitir editar publicado hasta el final de la semana (domingo)
  const we = addDaysToISO(ws, 6);
  return today <= we;
};

const canEditMenu = (menu) => {
  const status = String(menu?.status ?? "").toUpperCase().trim();
  if (status === "DRAFT") return true;
  if (status === "PUBLISHED" && isFutureOrCurrentWeek(menu.week_start)) return true;
  return false;
};

const normalizeDaysFromBody = (req) => {
  // Soporta:
  // - days[]=MON&days[]=FRI  (form-data)
  // - days: '["MON","FRI"]'  (string JSON)
  // - days: ["MON","FRI"]    (array)
  // - days: "MON,FRI"
  const rawDaysArray = req.body?.["days[]"];
  const rawDays = req.body?.days;

  let days = [];

  if (Array.isArray(rawDaysArray)) {
    days = rawDaysArray;
  } else if (typeof rawDaysArray === "string") {
    days = [rawDaysArray];
  } else if (Array.isArray(rawDays)) {
    days = rawDays;
  } else if (typeof rawDays === "string") {
    try {
      const parsed = JSON.parse(rawDays);
      if (Array.isArray(parsed)) days = parsed;
      else if (typeof parsed === "string") days = [parsed];
    } catch {
      days = [rawDays];
    }
  }

  // Aplanamos y dividimos por comas si alguna cadena contiene comas.
  let finalDays = [];
  for (const item of days) {
    if (typeof item === "string") {
      const parts = item.split(",").map((x) => x.trim()).filter(Boolean);
      finalDays.push(...parts);
    } else {
      finalDays.push(item);
    }
  }

  return finalDays
    .map((d) => String(d).toUpperCase().trim().replace(/[^A-Z]/g, ""))
    .filter(Boolean);
};

const weekdayToOffset = (day) => {
  const map = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4 };
  return map[day];
};

// ✅ limpia nombres de archivo para producción
const buildSafeDishFilename = (originalName) => {
  const rawName = String(originalName || "image");
  const ext = path.extname(rawName) || ".jpg";

  const baseName = path
    .basename(rawName, ext)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .trim();

  return `dish_${Date.now()}_${baseName}${ext.toLowerCase()}`;
};

// =====================================================
// GET /api/dishes
// =====================================================
export const listDishes = async (req, res) => {
  try {
    const dishes = await Dish.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    return res.json(dishes);
  } catch (error) {
    console.error("Error al listar platos:", error);
    return res.status(500).json({ message: "Error al obtener los productos" });
  }
};

// =====================================================
// POST /api/dishes
// =====================================================
export const createDish = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { name, description, price, stock, category_id } = req.body;

    const weeklyMenuIdRaw = req.body?.weekly_menu_id;
    const weekly_menu_id =
      weeklyMenuIdRaw !== undefined &&
      weeklyMenuIdRaw !== null &&
      String(weeklyMenuIdRaw).trim() !== ""
        ? parseInt(String(weeklyMenuIdRaw).trim(), 10)
        : null;

    if (weekly_menu_id !== null && Number.isNaN(weekly_menu_id)) {
      await t.rollback();
      return res.status(400).json({ message: "weekly_menu_id inválido" });
    }

    const days = normalizeDaysFromBody(req);
    if (!days || days.length === 0) {
      await t.rollback();
      return res.status(400).json({
        message: "Selecciona al menos 1 día (Lun–Vie).",
      });
    }

    const allowedDays = ["MON", "TUE", "WED", "THU", "FRI"];
    const invalid = days.filter((d) => !allowedDays.includes(d));
    if (invalid.length > 0) {
      await t.rollback();
      return res.status(400).json({
        message: `Días inválidos: ${JSON.stringify(invalid)}. Usa ${allowedDays.join(",")}`,
      });
    }

    const cleanName = String(name ?? "").trim();
    const priceNumber = parseFloat(price);

    const stockNumber =
      stock === undefined || stock === null || stock === ""
        ? 0
        : parseInt(stock, 10);

    const categoryIdNumber =
      category_id === undefined || category_id === null || category_id === ""
        ? null
        : parseInt(category_id, 10);

    if (!cleanName || Number.isNaN(priceNumber)) {
      await t.rollback();
      return res.status(400).json({ message: "Nombre y precio son obligatorios" });
    }

    if (Number.isNaN(stockNumber) || stockNumber < 0) {
      await t.rollback();
      return res.status(400).json({ message: "Stock inválido (>= 0)" });
    }

    if (categoryIdNumber !== null) {
      if (Number.isNaN(categoryIdNumber)) {
        await t.rollback();
        return res.status(400).json({ message: "category_id inválido" });
      }

      const category = await Category.findByPk(categoryIdNumber, { transaction: t });
      if (!category || !category.is_active) {
        await t.rollback();
        return res.status(400).json({ message: "Categoría inválida" });
      }
    }

    let targetMenu = null;

    if (weekly_menu_id !== null) {
      targetMenu = await WeeklyMenu.findByPk(weekly_menu_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!targetMenu) {
        await t.rollback();
        return res.status(404).json({ message: "Menú no encontrado" });
      }

      if (!canEditMenu(targetMenu)) {
        await t.rollback();
        return res.status(400).json({
          message:
            "Este menú no acepta productos (solo DRAFT o PUBLICADO futuro/vigente por fecha).",
        });
      }
    } else {
      const today = todayISO();

      const candidateMenus = await WeeklyMenu.findAll({
        where: {
          [Op.or]: [
            { status: "DRAFT" },
            {
              status: "PUBLISHED",
              week_start: { [Op.lte]: today },
            },
            {
              status: "PUBLISHED",
              week_start: { [Op.gt]: today },
            },
          ],
        },
        order: [
          ["week_start", "DESC"],
          ["id", "DESC"],
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      targetMenu = candidateMenus.find((menu) => canEditMenu(menu)) || null;

      if (!targetMenu) {
        await t.rollback();
        return res.status(400).json({
          message:
            "No hay un menú semanal editable (borrador o publicado vigente/futuro).",
        });
      }
    }

    const weekStart = normalizeDateOnly(targetMenu.week_start);
    if (!weekStart || !isValidDateOnly(weekStart)) {
      await t.rollback();
      return res.status(500).json({
        message: "weekly_menus.week_start inválido. Debe ser YYYY-MM-DD",
      });
    }

    let image_path = null;
    if (req.file) {
      const filename = buildSafeDishFilename(req.file.originalname);
      image_path = await saveFileFromMemory(
        req.file.buffer,
        filename,
        "uploads/dishes"
      );
    }

    const dish = await Dish.create(
      {
        name: cleanName,
        description: description ?? null,
        price: priceNumber,
        stock: stockNumber,
        category_id: categoryIdNumber,
        image_path,
      },
      { transaction: t }
    );

    const createdLinks = [];

    for (const d of days) {
      const offset = weekdayToOffset(d);
      if (offset === undefined) continue;

      const scheduled_for = addDaysToISO(weekStart, offset);

      const existing = await WeeklyMenuItem.findOne({
        where: {
          weekly_menu_id: targetMenu.id,
          scheduled_for,
          dish_id: dish.id,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!existing) {
        await WeeklyMenuItem.create(
          {
            weekly_menu_id: targetMenu.id,
            scheduled_for,
            dish_id: dish.id,
            is_enabled: 1,

            snapshot_name: dish.name ?? "",
            snapshot_description: dish.description ?? "",
            snapshot_price: dish.price ?? 0,
            snapshot_stock: dish.stock ?? 0,
            snapshot_image_path: dish.image_path ?? null,
            snapshot_category_id: dish.category_id ?? null,

            created_at: new Date(),
            updated_at: new Date(),
          },
          { transaction: t }
        );
      } else if (existing.is_enabled !== 1) {
        existing.is_enabled = 1;
        existing.snapshot_name = dish.name ?? existing.snapshot_name;
        existing.snapshot_description = dish.description ?? existing.snapshot_description;
        existing.snapshot_price = dish.price ?? existing.snapshot_price;
        existing.snapshot_stock = dish.stock ?? existing.snapshot_stock;
        existing.snapshot_image_path = dish.image_path ?? existing.snapshot_image_path;
        existing.snapshot_category_id = dish.category_id ?? existing.snapshot_category_id;
        existing.updated_at = new Date();

        await existing.save({ transaction: t });
      }

      createdLinks.push({
        weekly_menu_id: targetMenu.id,
        scheduled_for,
        dish_id: dish.id,
        is_enabled: 1,
      });
    }

    await t.commit();

    return res.json({
      message: "Producto creado y asignado al menú semanal ✅",
      dish,
      weekly_menu: {
        id: targetMenu.id,
        week_start: weekStart,
        status: targetMenu.status,
        is_active: targetMenu.is_active,
      },
      weekly_menu_items: createdLinks,
    });
  } catch (error) {
    try {
      await t.rollback();
    } catch {}

    console.error("Error al crear plato:", error);
    return res.status(500).json({
      message: "No se pudo crear el producto",
      error: error?.message,
    });
  }
};

// =====================================================
// PUT /api/dishes/:id
// ✅ actualiza dish + sincroniza snapshots
// =====================================================
export const updateDish = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category_id } = req.body;

    const dish = await Dish.findByPk(id);
    if (!dish) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    if (price !== undefined) {
      const priceNumber = parseFloat(price);
      if (Number.isNaN(priceNumber)) {
        return res.status(400).json({ message: "Precio inválido" });
      }
      dish.price = priceNumber;
    }

    if (stock !== undefined) {
      const stockNumber = parseInt(stock, 10);
      if (Number.isNaN(stockNumber) || stockNumber < 0) {
        return res.status(400).json({ message: "Stock inválido (>= 0)" });
      }
      dish.stock = stockNumber;
    }

    if (category_id !== undefined) {
      const categoryIdNumber =
        category_id === null || category_id === ""
          ? null
          : parseInt(category_id, 10);

      if (categoryIdNumber !== null) {
        if (Number.isNaN(categoryIdNumber)) {
          return res.status(400).json({ message: "category_id inválido" });
        }

        const category = await Category.findByPk(categoryIdNumber);
        if (!category || !category.is_active) {
          return res.status(400).json({ message: "Categoría inválida" });
        }
      }

      dish.category_id = categoryIdNumber;
    }

    if (req.file) {
      const filename = buildSafeDishFilename(req.file.originalname);
      dish.image_path = await saveFileFromMemory(
        req.file.buffer,
        filename,
        "uploads/dishes"
      );
    }

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (cleanName) dish.name = cleanName;
    }

    if (description !== undefined) {
      dish.description = description ?? null;
    }

    await dish.save();

    // ✅ sincroniza snapshots en weekly_menu_items
    await WeeklyMenuItem.update(
      {
        snapshot_name: dish.name,
        snapshot_description: dish.description,
        snapshot_price: dish.price,
        snapshot_stock: dish.stock,
        snapshot_image_path: dish.image_path,
        snapshot_category_id: dish.category_id,
        updated_at: new Date(),
      },
      {
        where: {
          dish_id: dish.id,
        },
      }
    );

    return res.json({
      message: "Producto actualizado",
      dish,
    });
  } catch (error) {
    console.error("Error al actualizar plato:", error);
    return res.status(500).json({
      message: "No se pudo actualizar el producto",
      error: error?.message,
    });
  }
};

// =====================================================
// DELETE /api/dishes/:id  (soft delete)
// =====================================================
export const deleteDish = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await Dish.findByPk(id);
    if (!dish) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    dish.is_active = false;
    await dish.save();

    return res.json({ message: "Producto desactivado correctamente" });
  } catch (error) {
    console.error("Error al eliminar plato:", error);
    return res.status(500).json({ message: "No se pudo eliminar el producto" });
  }
};