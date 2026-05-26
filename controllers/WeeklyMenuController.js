import { Op } from "sequelize";
import { sequelize } from "../db/conexion.js";

import { WeeklyMenu } from "../models/WeeklyMenuModel.js";
import { WeeklyMenuItem } from "../models/WeeklyMenuItemModel.js";
import { Dish } from "../models/DishModel.js";
import { Category } from "../models/CategoryModel.js";

// ==============================
// Helpers (DateOnly seguros - evita bug UTC)
// ==============================
const isValidDateOnly = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const normalizeDateOnly = (value) => (value ? String(value).slice(0, 10) : null);

const todayISO = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDaysToISO = (isoDate, add) => {
  const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
  const base = new Date(y, m - 1, d); // LOCAL
  base.setDate(base.getDate() + add);

  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Parse ISO YYYY-MM-DD como fecha LOCAL (no UTC)
const parseISODateLocal = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Diferencia de días segura (LOCAL)
const diffDaysLocal = (isoA, isoB) => {
  const a = parseISODateLocal(isoA);
  const b = parseISODateLocal(isoB);
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

// ==============================
// ✅ NORMALIZAR SEMANA A LUNES (Lun–Vie)
// ==============================
const getMondayOfWeek = (isoDate) => {
  const iso = normalizeDateOnly(isoDate);
  if (!iso || !isValidDateOnly(iso)) return null;

  const d = parseISODateLocal(iso);
  // getDay(): 0=Dom,1=Lun,2=Mar...6=Sáb
  const day = d.getDay();
  const offsetToMonday = (day + 6) % 7; // Lun=>0, Mar=>1, ... Dom=>6
  d.setDate(d.getDate() - offsetToMonday);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getWeekEndFriday = (weekStartMonday) => addDaysToISO(weekStartMonday, 4);

// ✅ Editable si:
// - DRAFT (siempre)
// - PUBLISHED FUTURO o VIGENTE (hoy <= week_end)
const isFutureOrCurrentWeek = (weekStartISO) => {
  const today = todayISO();
  const ws0 = normalizeDateOnly(weekStartISO);
  if (!ws0 || !isValidDateOnly(ws0)) return false;

  const ws = getMondayOfWeek(ws0);
  if (!ws) return false;

  const we = getWeekEndFriday(ws);
  return today <= we;
};

const canEditMenu = (menu) => {
  const status = String(menu?.status ?? "").toUpperCase().trim();
  if (status === "DRAFT") return true;
  if (status === "PUBLISHED" && isFutureOrCurrentWeek(menu.week_start)) return true;
  return false;
};

// ==============================
// Build items_by_day (Lun–Vie)
// ==============================
const buildItemsByDay = async (menuId, weekStart, t = null) => {
  const ws = getMondayOfWeek(weekStart);
  if (!ws) return null;

  const items = await WeeklyMenuItem.findAll({
    where: { weekly_menu_id: menuId },
    order: [["scheduled_for", "ASC"]],
    include: [
      {
        model: Dish,
        as: "dish",
        required: true,
        where: { is_active: true },
        include: [{ model: Category, as: "category", attributes: ["id", "name"], required: false }],
      },
    ],
    transaction: t || undefined,
  });

  const mapDayName = (offset) => {
    const names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    return names[offset] || "";
  };

  const items_by_day = {};
  for (let offset = 0; offset < 5; offset++) {
    const date = addDaysToISO(ws, offset);
    items_by_day[`D${offset}`] = { date, day_name: mapDayName(offset), items: [] };
  }

  for (const it of items) {
    const scheduled = normalizeDateOnly(it.scheduled_for);
    if (!scheduled) continue;

    const offset = diffDaysLocal(scheduled, ws);
    if (offset < 0 || offset >= 5) continue;

    const dishSnapshot = {
      id: it.dish_id,
      name: it.snapshot_name ?? it.dish?.name,
      description: it.snapshot_description ?? it.dish?.description,
      price: it.snapshot_price ?? it.dish?.price,
      stock: it.snapshot_stock ?? it.dish?.stock,
      image_path: it.snapshot_image_path ?? it.dish?.image_path,
      category_id: it.snapshot_category_id ?? it.dish?.category_id,
      category: it.dish?.category ?? undefined,
    };

    items_by_day[`D${offset}`].items.push({
      weekly_menu_item_id: it.id,
      scheduled_for: scheduled,
      dish_id: it.dish_id,
      is_enabled: it.is_enabled,
      dish: dishSnapshot,
    });
  }

  return items_by_day;
};

// =====================================================
// ✅ NUEVO: POST /api/weekly-menus/draft/create
// ✅ BOOTSTRAP: si no existe nada, permite crear el primer DRAFT
// Body opcional: { week_start: "YYYY-MM-DD", mode: "current" | "next" }
// - current: crea para la semana actual (lunes)
// - next: crea para la semana siguiente (lunes+7) [default]
// =====================================================
export const createDraftMenuForWeek = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const today = todayISO();

    const mode = String(req.body?.mode ?? "next").toLowerCase(); // next por defecto
    const requested = normalizeDateOnly(req.body?.week_start);

    let monday = null;

    if (requested) {
      if (!isValidDateOnly(requested)) {
        await t.rollback();
        return res.status(400).json({ message: "week_start inválido" });
      }
      monday = getMondayOfWeek(requested);
    } else {
      const thisMonday = getMondayOfWeek(today);
      if (!thisMonday) {
        await t.rollback();
        return res.status(500).json({ message: "No se pudo calcular la semana actual" });
      }

      // Empezamos la búsqueda de una semana disponible.
      // Si mode === "current", empezamos desde la semana actual (thisMonday).
      // Si mode === "next", empezamos desde la semana siguiente (thisMonday + 7 días).
      let currentCheck = mode === "current" ? thisMonday : addDaysToISO(thisMonday, 7);
      let foundWeek = null;

      // Buscamos hasta por 10 semanas en el futuro una fecha disponible sin menú asignado
      for (let i = 0; i < 10; i++) {
        const existsMenu = await WeeklyMenu.findOne({
          where: { week_start: currentCheck },
          transaction: t,
        });

        if (!existsMenu) {
          foundWeek = currentCheck;
          break;
        }
        currentCheck = addDaysToISO(currentCheck, 7);
      }

      monday = foundWeek || currentCheck;
    }

    if (!monday) {
      await t.rollback();
      return res.status(500).json({ message: "No se pudo calcular el lunes" });
    }

    // si ya existe un menú para esa semana (DRAFT o PUBLISHED), no crear duplicado
    const exists = await WeeklyMenu.findOne({
      where: { week_start: monday },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (exists) {
      await t.commit();
      return res.json({
        message: "Ya existe un menú para esa semana",
        id: exists.id,
        week_start: monday,
        status: exists.status,
      });
    }

    const created_by = req.user?.id;

    const draft = await WeeklyMenu.create(
      {
        week_start: monday,
        status: "DRAFT",
        is_active: 0,
        created_by,
        published_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();
    return res.json({
      message: "✅ Borrador creado (bootstrap)",
      id: draft.id,
      week_start: monday,
      status: draft.status,
    });
  } catch (e) {
    try {
      await t.rollback();
    } catch { }
    console.error(e);
    return res.status(500).json({ message: "No se pudo crear el borrador", error: String(e) });
  }
};

// =====================================================
// ✅ NUEVO: POST /api/weekly-menu-items
// ✅ Agrega un producto a un día (sirve cuando está vacío)
// Body: { weekly_menu_id, scheduled_for, dish_id }
// =====================================================
export const addWeeklyMenuItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const weekly_menu_id = Number(req.body?.weekly_menu_id);
    const scheduled_for_raw = normalizeDateOnly(req.body?.scheduled_for);
    const dish_id = Number(req.body?.dish_id);

    if (!weekly_menu_id) {
      await t.rollback();
      return res.status(400).json({ message: "weekly_menu_id inválido" });
    }
    if (!scheduled_for_raw || !isValidDateOnly(scheduled_for_raw)) {
      await t.rollback();
      return res.status(400).json({ message: "scheduled_for inválido (YYYY-MM-DD)" });
    }
    if (!dish_id) {
      await t.rollback();
      return res.status(400).json({ message: "dish_id inválido" });
    }

    const menu = await WeeklyMenu.findByPk(weekly_menu_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) {
      await t.rollback();
      return res.status(404).json({ message: "Menú no encontrado" });
    }
    if (!canEditMenu(menu)) {
      await t.rollback();
      return res.status(400).json({ message: "Este menú no se puede editar." });
    }

    const weekStart = getMondayOfWeek(menu.week_start);
    if (!weekStart) {
      await t.rollback();
      return res.status(500).json({ message: "week_start inválido en menú" });
    }

    // solo permitir Lun-Vie de ESA semana
    const offset = diffDaysLocal(scheduled_for_raw, weekStart);
    if (offset < 0 || offset > 4) {
      await t.rollback();
      return res.status(400).json({
        message: `scheduled_for fuera de rango. Debe ser entre ${weekStart} y ${getWeekEndFriday(weekStart)}`,
      });
    }

    const dish = await Dish.findByPk(dish_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
      include: [{ model: Category, as: "category", attributes: ["id", "name"], required: false }],
    });

    if (!dish || !dish.is_active) {
      await t.rollback();
      return res.status(404).json({ message: "Producto no encontrado o inactivo" });
    }

    // evita duplicar mismo dish el mismo día en el mismo menú
    const already = await WeeklyMenuItem.findOne({
      where: { weekly_menu_id, scheduled_for: scheduled_for_raw, dish_id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (already) {
      await t.rollback();
      return res.status(409).json({ message: "Ese producto ya está agregado en ese día", id: already.id });
    }

    const created = await WeeklyMenuItem.create(
      {
        weekly_menu_id,
        scheduled_for: scheduled_for_raw,
        dish_id,
        is_enabled: true,

        // snapshot (para que editar no afecte otros menús)
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

    await t.commit();
    return res.json({ message: "✅ Producto agregado al día", id: created.id });
  } catch (e) {
    try {
      await t.rollback();
    } catch { }
    console.error(e);
    return res.status(500).json({ message: "No se pudo agregar el producto al día", error: String(e) });
  }
};

// =====================================================
// GET /api/weekly-menus/active
// ✅ Padres: menú PUBLISHED vigente por FECHA (rango)
// =====================================================
export const getActivePublishedMenu = async (req, res) => {
  try {
    const today = todayISO();
    const requestedWeek = normalizeDateOnly(req.query?.week_start);

    let menu = null;

    if (requestedWeek && isValidDateOnly(requestedWeek)) {
      const targetMonday = getMondayOfWeek(requestedWeek);
      menu = await WeeklyMenu.findOne({
        where: { status: "PUBLISHED", week_start: targetMonday }
      });
    } else {
      const targetDate = addDaysToISO(today, 2);
      // PUBLISHED más reciente que empieza antes o en targetDate (para habilitar desde el sábado anterior)
      menu = await WeeklyMenu.findOne({
        where: { status: "PUBLISHED", week_start: { [Op.lte]: targetDate } },
        order: [["week_start", "DESC"]],
      });
    }

    // ✅ Si no hay menú publicado vigente, devolver null en vez de 404
    if (!menu) return res.json(null);

    const weekStartRaw = normalizeDateOnly(menu.week_start);
    if (!weekStartRaw || !isValidDateOnly(weekStartRaw)) {
      return res.status(500).json({ message: "week_start inválido en menú publicado" });
    }

    const weekStart = getMondayOfWeek(weekStartRaw);
    if (!weekStart) {
      return res.status(500).json({ message: "No se pudo normalizar week_start" });
    }

    const weekEnd = getWeekEndFriday(weekStart);

    // ✅ Si ya pasó la semana, devolver null en vez de 404
    if (today > weekEnd) {
      return res.json(null);
    }

    // Si el menú tiene `visible_from` y hoy es anterior, solo permitir verlo a roles internos (BAR/ADMIN)
    // EXCEPCIÓN: Si hoy es el sábado o domingo previo al inicio del menú (hoy >= week_start - 2), permitir verlo a todos.
    const visibleFromRaw = normalizeDateOnly(menu.visible_from);
    if (visibleFromRaw && isValidDateOnly(visibleFromRaw)) {
      const isWeekendPrior = today >= addDaysToISO(weekStart, -2);
      if (today < visibleFromRaw && !isWeekendPrior) {
        const role = req.user ? String(req.user.role || '').toUpperCase() : '';
        if (!(role === 'BAR' || role === 'ADMIN')) {
          return res.json(null);
        }
      }
    }

    const items_by_day = await buildItemsByDay(menu.id, weekStart);
    if (!items_by_day) {
      return res.status(500).json({ message: "No se pudo armar items_by_day" });
    }

    return res.json({
      id: menu.id,
      week_start: weekStart,
      status: menu.status,
      is_active: menu.is_active,
      items_by_day,
      editable: canEditMenu(menu),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error al cargar el menú activo" });
  }
};
// =====================================================
// GET /api/weekly-menus/draft/latest
// =====================================================
export const getLatestDraftMenu = async (req, res) => {
  try {
    const menu = await WeeklyMenu.findOne({
      where: { status: "DRAFT" },
      order: [["week_start", "DESC"]],
    });

    if (!menu) return res.json({ menu: null, message: "No hay borrador" });

    const weekStart = getMondayOfWeek(menu.week_start);
    const items_by_day = await buildItemsByDay(menu.id, weekStart);

    return res.json({
      id: menu.id,
      week_start: weekStart,
      status: menu.status,
      is_active: menu.is_active,
      items_by_day,
      editable: canEditMenu(menu),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error al cargar el borrador" });
  }
};


// =====================================================
// POST /api/weekly-menus/draft/recycle-previous
// ✅ recicla desde el PUBLISHED vigente por rango
// =====================================================
export const recyclePreviousToDraft = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const today = todayISO();

    const force = String(req.query?.force ?? "0") === "1";
    const replacePublished = String(req.query?.replacePublished ?? "0") === "1";

    // 1) Cargar el menú PUBLICADO más reciente de la base de datos (incluso si ya pasó)
    const activePublished = await WeeklyMenu.findOne({
      where: { status: "PUBLISHED" },
      order: [["week_start", "DESC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!activePublished) {
      await t.rollback();
      return res.status(404).json({ message: "No hay menú publicado para reciclar" });
    }

    const activeWeekStartRaw = normalizeDateOnly(activePublished.week_start);
    if (!activeWeekStartRaw || !isValidDateOnly(activeWeekStartRaw)) {
      await t.rollback();
      return res.status(500).json({ message: "week_start inválido en menú publicado" });
    }

    const activeWeekStart = getMondayOfWeek(activeWeekStartRaw);
    if (!activeWeekStart) {
      await t.rollback();
      return res.status(500).json({ message: "No se pudo normalizar week_start" });
    }

    // 2) Semana siguiente (lunes)
    const nextWeekStart = addDaysToISO(activeWeekStart, 7);

    // 3) Existe algo ya en esa semana
    const exists = await WeeklyMenu.findOne({
      where: { week_start: nextWeekStart },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const copyItemsFromPublishedTo = async (targetMenuId) => {
      await WeeklyMenuItem.destroy({ where: { weekly_menu_id: targetMenuId }, transaction: t });

      const prevItems = await WeeklyMenuItem.findAll({
        where: { weekly_menu_id: activePublished.id },
        include: [
          {
            model: Dish,
            as: "dish",
            required: true,
            include: [{ model: Category, as: "category", attributes: ["id", "name"], required: false }],
          },
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      for (const it of prevItems) {
        const scheduled = normalizeDateOnly(it.scheduled_for);
        if (!scheduled) continue;

        const offset = diffDaysLocal(scheduled, activeWeekStart);
        if (offset < 0 || offset > 4) continue;

        const newScheduled = addDaysToISO(nextWeekStart, offset);

        const snapName = it.snapshot_name ?? it.dish?.name ?? "";
        const snapDesc = it.snapshot_description ?? it.dish?.description ?? "";
        const snapPrice = it.snapshot_price ?? it.dish?.price ?? 0;
        const snapStock = it.snapshot_stock ?? it.dish?.stock ?? 0;
        const snapImg = it.snapshot_image_path ?? it.dish?.image_path ?? null;
        const snapCat = it.snapshot_category_id ?? it.dish?.category_id ?? null;

        await WeeklyMenuItem.create(
          {
            weekly_menu_id: targetMenuId,
            scheduled_for: newScheduled,
            dish_id: it.dish_id,
            is_enabled: true,
            snapshot_name: snapName,
            snapshot_description: snapDesc,
            snapshot_price: snapPrice,
            snapshot_stock: snapStock,
            snapshot_image_path: snapImg,
            snapshot_category_id: snapCat,
            created_at: new Date(),
            updated_at: new Date(),
          },
          { transaction: t }
        );
      }
    };

    if (exists) {
      const existsStatus = String(exists.status ?? "").toUpperCase().trim();

      if (!force) {
        await t.rollback();
        return res.status(409).json({
          message:
            existsStatus === "PUBLISHED"
              ? "Ya existe un menú PUBLICADO para la semana siguiente."
              : "Ya existe un borrador para la semana siguiente.",
          code: existsStatus === "PUBLISHED" ? "PUBLISHED_EXISTS" : "DRAFT_EXISTS",
          id: exists.id,
          week_start: nextWeekStart,
          status: existsStatus,
        });
      }

      if (existsStatus === "PUBLISHED" && !replacePublished) {
        await t.rollback();
        return res.status(400).json({
          message: "Para reemplazar un menú PUBLICADO debes enviar replacePublished=1",
          code: "NEED_REPLACE_PUBLISHED",
          id: exists.id,
          week_start: nextWeekStart,
        });
      }

      await WeeklyMenuItem.destroy({ where: { weekly_menu_id: exists.id }, transaction: t });
      await WeeklyMenu.destroy({ where: { id: exists.id }, transaction: t });
    }

    const created_by = req.user?.id || activePublished.created_by;

    const draft = await WeeklyMenu.create(
      {
        week_start: nextWeekStart,
        status: "DRAFT",
        is_active: 0,
        created_by,
        published_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      { transaction: t }
    );

    await copyItemsFromPublishedTo(draft.id);

    await t.commit();
    return res.json({
      message: "✅ Borrador creado para la semana siguiente (reciclado)",
      id: draft.id,
      week_start: nextWeekStart,
    });
  } catch (e) {
    try {
      await t.rollback();
    } catch { }
    console.error(e);
    return res.status(500).json({ message: "No se pudo reciclar la semana", error: String(e) });
  }
};


// =====================================================
// GET /api/weekly-menus/published/next
// ✅ próximo PUBLISHED dentro del rango de la próxima semana
// =====================================================
export const getNextPublishedMenu = async (req, res) => {
  try {
    const today = todayISO();
    const thisMonday = getMondayOfWeek(today);
    const nextMonday = addDaysToISO(thisMonday, 7);
    const nextSunday = addDaysToISO(nextMonday, 6);

    const menu = await WeeklyMenu.findOne({
      where: {
        status: "PUBLISHED",
        week_start: { [Op.between]: [nextMonday, nextSunday] },
      },
      order: [["week_start", "ASC"]],
    });

    if (!menu) return res.json({ menu: null, message: "No hay menú publicado futuro" });

    const weekStart = getMondayOfWeek(menu.week_start);
    const items_by_day = await buildItemsByDay(menu.id, weekStart);

    return res.json({
      id: menu.id,
      week_start: weekStart,
      status: menu.status,
      is_active: menu.is_active,
      items_by_day,
      is_future: true,
      editable: canEditMenu(menu),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Error al cargar el próximo menú publicado" });
  }
};

// =====================================================
// POST /api/weekly-menus/:id/publish
// ✅ Publica borrador (NO lo hace vigente)
// =====================================================
export const publishDraftMenu = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "ID inválido" });
    }

    const draft = await WeeklyMenu.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!draft) {
      await t.rollback();
      return res.status(404).json({ message: "Borrador no encontrado" });
    }

    const status = String(draft.status ?? "").toUpperCase().trim();
    if (status !== "DRAFT") {
      await t.rollback();
      return res.status(400).json({ message: "Solo se puede publicar un borrador (DRAFT)" });
    }

    const weekStartRaw = normalizeDateOnly(draft.week_start);
    if (!weekStartRaw || !isValidDateOnly(weekStartRaw)) {
      await t.rollback();
      return res.status(400).json({ message: "week_start inválido" });
    }

    const weekStart = getMondayOfWeek(weekStartRaw);
    if (!weekStart) {
      await t.rollback();
      return res.status(400).json({ message: "No se pudo normalizar week_start" });
    }

    // Recomendado: forzar en BD que sea lunes
    draft.week_start = weekStart;

    const alreadyPublished = await WeeklyMenu.findOne({
      where: { id: { [Op.ne]: draft.id }, week_start: weekStart, status: "PUBLISHED" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (alreadyPublished) {
      await t.rollback();
      return res.status(400).json({
        message: "Ya existe un menú PUBLICADO para esa semana. No se puede publicar este borrador.",
        published_id: alreadyPublished.id,
      });
    }

    draft.status = "PUBLISHED";
    draft.is_active = 0;
    draft.published_at = new Date();
    // visible_from puede venir en el body (YYYY-MM-DD). Si no, por defecto será la fecha de publicación (hoy).
    const vfRaw = normalizeDateOnly(req.body?.visible_from);
    if (vfRaw && isValidDateOnly(vfRaw)) {
      draft.visible_from = vfRaw;
    } else {
      draft.visible_from = normalizeDateOnly(draft.published_at);
    }
    draft.updated_at = new Date();

    await draft.save({ transaction: t });

    await t.commit();
    return res.json({
      message: "✅ Menú publicado. Los padres lo verán cuando llegue su semana.",
      id: draft.id,
      week_start: weekStart,
    });
  } catch (e) {
    try {
      await t.rollback();
    } catch { }
    console.error(e);
    return res.status(500).json({ message: "No se pudo publicar el menú", error: String(e) });
  }
};

// =====================================================
// PUT /api/weekly-menu-items/:id
// =====================================================
export const updateWeeklyMenuItemSnapshot = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "ID inválido" });
    }

    const item = await WeeklyMenuItem.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!item) {
      await t.rollback();
      return res.status(404).json({ message: "Item no encontrado" });
    }

    const menu = await WeeklyMenu.findByPk(item.weekly_menu_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!menu) {
      await t.rollback();
      return res.status(404).json({ message: "Menú no encontrado para este item" });
    }

    if (!canEditMenu(menu)) {
      await t.rollback();
      return res.status(400).json({
        message: "Este menú no se puede editar.",
      });
    }

    const {
      name,
      description,
      price,
      stock,
      category_id,
      image_path,
    } = req.body ?? {};

    if (name !== undefined) {
      const v = String(name).trim();
      if (!v) {
        await t.rollback();
        return res.status(400).json({ message: "Nombre inválido" });
      }
      item.snapshot_name = v;
    }

    if (description !== undefined) {
      item.snapshot_description = description ? String(description) : "";
    }

    if (price !== undefined) {
      const p = Number(price);
      if (Number.isNaN(p) || p < 0) {
        await t.rollback();
        return res.status(400).json({ message: "Precio inválido" });
      }
      item.snapshot_price = Number(p.toFixed(2));
    }

    if (stock !== undefined) {
      const s = Number(stock);
      if (!Number.isInteger(s) || s < 0) {
        await t.rollback();
        return res.status(400).json({ message: "Stock inválido" });
      }
      item.snapshot_stock = s;
    }

    if (category_id !== undefined) {
      const c = Number(category_id);

      if (Number.isNaN(c) || c <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "Categoría inválida" });
      }

      const category = await Category.findByPk(c);

      if (!category || !category.is_active) {
        await t.rollback();
        return res.status(400).json({ message: "Categoría no válida" });
      }

      item.snapshot_category_id = c;
    }

    if (image_path !== undefined) {
      item.snapshot_image_path =
        image_path && String(image_path).trim() !== ""
          ? String(image_path)
          : null;
    }

    item.updated_at = new Date();

    await item.save({ transaction: t });

    await t.commit();

    return res.json({
      message: "✅ Item actualizado (solo en este menú)",
      id: item.id,
    });
  } catch (e) {
    try {
      await t.rollback();
    } catch { }

    console.error(e);

    return res.status(500).json({
      message: "No se pudo actualizar el item",
      error: String(e),
    });
  }
};
// =====================================================
// DELETE /api/weekly-menu-items/:id
// =====================================================
export const deleteWeeklyMenuItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "ID inválido" });
    }

    const item = await WeeklyMenuItem.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ message: "Item no encontrado" });
    }

    const menu = await WeeklyMenu.findByPk(item.weekly_menu_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!menu) {
      await t.rollback();
      return res.status(404).json({ message: "Menú no encontrado para este item" });
    }

    if (!canEditMenu(menu)) {
      await t.rollback();
      return res.status(400).json({
        message: "Este menú no se puede editar (solo DRAFT o PUBLISHED futuro/vigente).",
      });
    }

    await item.destroy({ transaction: t });

    await t.commit();
    return res.json({
      message: "✅ Producto eliminado definitivamente del día",
      id,
      weekly_menu_id: menu.id,
    });
  } catch (e) {
    try {
      await t.rollback();
    } catch { }
    console.error(e);
    return res.status(500).json({
      message: "No se pudo eliminar definitivamente el producto del día",
      error: String(e?.message ?? e),
    });
  }
};
