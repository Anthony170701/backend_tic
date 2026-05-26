import { Op } from "sequelize";
import { sequelize } from "../db/conexion.js";

import { Order } from "../models/OrderModel.js";
import { OrderItem } from "../models/OrderItemModel.js";
import { Dish } from "../models/DishModel.js";
import { User } from "../models/UserModel.js";
import { WeeklyMenuItem } from "../models/WeeklyMenuItemModel.js";

import { saveFileFromMemory } from "../middleware/uploadMiddleware.js";

// ------------------------------
// Helpers
// ------------------------------
const isValidDateOnly = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const toISODateOnly = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseJSONSafe = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const round2 = (n) => Number((Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2));

const validateWeeklyMenuDay = async ({ weekly_menu_id, scheduled_for, items, t }) => {
  const dishIds = [...new Set(items.map((it) => Number(it.dish_id)))];

  const allowed = await WeeklyMenuItem.findAll({
    where: {
      weekly_menu_id: Number(weekly_menu_id),
      scheduled_for,
      is_enabled: 1,
      dish_id: { [Op.in]: dishIds },
    },
    transaction: t,
  });

  if (allowed.length !== dishIds.length) {
    throw new Error(`Hay productos no habilitados para ${scheduled_for} en el menú semanal`);
  }
};

const getDishesAndCompute = async ({ items, t }) => {
  const dishIds = [...new Set(items.map((it) => Number(it.dish_id)))];

  const dishes = await Dish.findAll({
    where: { id: dishIds },
    transaction: t,
  });

  if (dishes.length !== dishIds.length) {
    throw new Error("Uno o más productos no existen");
  }

  const dishMap = new Map(dishes.map((d) => [d.id, d]));

  let total = 0;
  for (const it of items) {
    const dishId = Number(it.dish_id);
    const qty = Number(it.qty);

    if (!dishId || isNaN(dishId) || dishId <= 0) throw new Error("dish_id inválido en items");
    if (!qty || isNaN(qty) || qty <= 0) throw new Error("qty inválido en items");

    const dish = dishMap.get(dishId);
    if (!dish) throw new Error("Producto no existe");
    if (dish.is_active === false) throw new Error(`Producto inactivo: "${dish.name}"`);

    total += Number(dish.price) * qty;
  }

  return { dishes, dishMap, total: round2(total) };
};

/**
 * =====================================================
 * POST /api/orders
 * =====================================================
 */
export const createOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const user_id = req.user?.id;
    const { payment_reference, student_id, items, scheduled_for, weekly_menu_id } = req.body;

    if (!user_id) {
      await t.rollback();
      return res.status(401).json({ message: "No autenticado" });
    }

    const studentIdNum = Number(student_id);
    if (!student_id || isNaN(studentIdNum) || studentIdNum <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "student_id inválido" });
    }

    const student = await User.findByPk(studentIdNum, { transaction: t });
    if (!student || student.role !== "ESTUDIANTE") {
      await t.rollback();
      return res.status(400).json({ message: "El estudiante seleccionado no es válido" });
    }

    if (!payment_reference || !payment_reference.trim()) {
      await t.rollback();
      return res.status(400).json({ message: "Ingresa el número de comprobante" });
    }

    if (!req.file) {
      await t.rollback();
      return res.status(400).json({ message: "Debes subir la imagen del comprobante" });
    }

    let scheduledForValue = null;
    if (scheduled_for) {
      if (!isValidDateOnly(scheduled_for)) {
        await t.rollback();
        return res.status(400).json({ message: "scheduled_for debe ser YYYY-MM-DD" });
      }
      const todayISO = toISODateOnly(new Date());
      if (scheduled_for < todayISO) {
        await t.rollback();
        return res.status(400).json({ message: "No se puede programar fechas pasadas" });
      }
      scheduledForValue = scheduled_for;
    }

    if (!items) {
      await t.rollback();
      return res.status(400).json({ message: "Items requeridos" });
    }

    const parsedItems = parseJSONSafe(items, null);
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "El pedido debe tener al menos 1 item" });
    }

    const weeklyMenuIdNum = weekly_menu_id ? Number(weekly_menu_id) : null;
    if (weeklyMenuIdNum) {
      if (!scheduledForValue) {
        await t.rollback();
        return res.status(400).json({
          message: "Si envías weekly_menu_id, debes enviar scheduled_for para validar el menú del día",
        });
      }
      await validateWeeklyMenuDay({
        weekly_menu_id: weeklyMenuIdNum,
        scheduled_for: scheduledForValue,
        items: parsedItems,
        t,
      });
    }

    const safeName = req.file.originalname.replace(/\s+/g, "_");
    const filename = `receipt_${Date.now()}_${safeName}`;
    const receipt_image_path = await saveFileFromMemory(req.file.buffer, filename, "uploads/receipts");

    const { dishMap, total } = await getDishesAndCompute({ items: parsedItems, t });

    const order = await Order.create(
      {
        user_id,
        student_id: studentIdNum,
        total,
        payment_reference: payment_reference.trim(),
        receipt_image_path,
        status: "PENDIENTE",
        payment_verified_at: null,
        created_at: new Date(),
        scheduled_for: scheduledForValue,
        weekly_menu_id: weeklyMenuIdNum ? weeklyMenuIdNum : null,
      },
      { transaction: t }
    );

    const orderItemsPayload = parsedItems.map((it) => {
      const dish = dishMap.get(Number(it.dish_id));
      return {
        order_id: order.id,
        dish_id: Number(it.dish_id),
        quantity: Number(it.qty),
        price: Number(dish.price),
      };
    });

    await OrderItem.bulkCreate(orderItemsPayload, { transaction: t });

    await t.commit();

    return res.json({
      message: "Pedido creado ✅ (PENDIENTE)",
      order,
      items: orderItemsPayload,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error al crear pedido:", error);
    return res.status(500).json({
      message: "No se pudo crear el pedido",
      error: error?.message,
    });
  }
};

/**
 * =====================================================
 * POST /api/orders/weekly
 * =====================================================
 */
export const createWeeklyOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const user_id = req.user?.id;
    const { payment_reference, student_id, days, weekly_menu_id } = req.body;

    if (!user_id) {
      await t.rollback();
      return res.status(401).json({ message: "No autenticado" });
    }

    const studentIdNum = Number(student_id);
    if (!student_id || isNaN(studentIdNum) || studentIdNum <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "student_id inválido" });
    }

    const student = await User.findByPk(studentIdNum, { transaction: t });
    if (!student || student.role !== "ESTUDIANTE") {
      await t.rollback();
      return res.status(400).json({ message: "El estudiante seleccionado no es válido" });
    }

    const weeklyMenuIdNum = Number(weekly_menu_id);
    if (!weekly_menu_id || isNaN(weeklyMenuIdNum) || weeklyMenuIdNum <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "weekly_menu_id es requerido" });
    }

    if (!payment_reference || !payment_reference.trim()) {
      await t.rollback();
      return res.status(400).json({ message: "Ingresa el número de comprobante" });
    }

    if (!req.file) {
      await t.rollback();
      return res.status(400).json({ message: "Debes subir la imagen del comprobante semanal" });
    }

    if (!days) {
      await t.rollback();
      return res.status(400).json({ message: "days es requerido" });
    }

    const parsedDays = parseJSONSafe(days, null);
    if (!Array.isArray(parsedDays) || parsedDays.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "Debes enviar al menos 1 día" });
    }

    const safeName = req.file.originalname.replace(/\s+/g, "_");
    const filename = `receipt_week_${Date.now()}_${safeName}`;
    const receipt_image_path = await saveFileFromMemory(req.file.buffer, filename, "uploads/receipts");

    const todayISO = toISODateOnly(new Date());

    const allItems = [];
    for (const d of parsedDays) {
      if (!d?.scheduled_for || !isValidDateOnly(d.scheduled_for)) {
        await t.rollback();
        return res.status(400).json({ message: "Cada día debe tener scheduled_for YYYY-MM-DD" });
      }
      if (d.scheduled_for < todayISO) {
        await t.rollback();
        return res.status(400).json({ message: "No se puede programar fechas pasadas" });
      }
      if (!Array.isArray(d?.items) || d.items.length === 0) {
        await t.rollback();
        return res.status(400).json({ message: "Cada día debe tener items (no vacío)" });
      }

      for (const it of d.items) {
        const dishId = Number(it.dish_id);
        const qty = Number(it.qty);
        if (!dishId || isNaN(dishId) || dishId <= 0) {
          await t.rollback();
          return res.status(400).json({ message: "dish_id inválido en days.items" });
        }
        if (!qty || isNaN(qty) || qty <= 0) {
          await t.rollback();
          return res.status(400).json({ message: "qty inválido en days.items" });
        }
        allItems.push({ dish_id: dishId, qty });
      }
    }

    const dishIds = [...new Set(allItems.map((x) => x.dish_id))];
    const dishes = await Dish.findAll({
      where: { id: dishIds },
      transaction: t,
    });

    if (dishes.length !== dishIds.length) {
      await t.rollback();
      return res.status(400).json({ message: "Uno o más productos no existen" });
    }

    const dishMap = new Map(dishes.map((d) => [d.id, d]));
    for (const d of dishes) {
      if (d.is_active === false) {
        await t.rollback();
        return res.status(400).json({ message: `Producto inactivo: "${d.name}"` });
      }
    }

    for (const d of parsedDays) {
      await validateWeeklyMenuDay({
        weekly_menu_id: weeklyMenuIdNum,
        scheduled_for: d.scheduled_for,
        items: d.items,
        t,
      });
    }

    const created = [];
    let weekTotal = 0;

    for (const d of parsedDays) {
      let dayTotal = 0;
      for (const it of d.items) {
        const dish = dishMap.get(Number(it.dish_id));
        dayTotal += Number(dish.price) * Number(it.qty);
      }
      dayTotal = round2(dayTotal);
      weekTotal += dayTotal;

      const order = await Order.create(
        {
          user_id,
          student_id: studentIdNum,
          total: dayTotal,
          payment_reference: payment_reference.trim(),
          receipt_image_path,
          status: "PENDIENTE",
          payment_verified_at: null,
          created_at: new Date(),
          scheduled_for: d.scheduled_for,
          weekly_menu_id: weeklyMenuIdNum,
        },
        { transaction: t }
      );

      const orderItemsPayload = d.items.map((it) => {
        const dish = dishMap.get(Number(it.dish_id));
        return {
          order_id: order.id,
          dish_id: Number(it.dish_id),
          quantity: Number(it.qty),
          price: Number(dish.price),
        };
      });

      await OrderItem.bulkCreate(orderItemsPayload, { transaction: t });

      created.push({
        order_id: order.id,
        scheduled_for: d.scheduled_for,
        total: dayTotal,
      });
    }

    await t.commit();

    return res.json({
      message: "Compra semanal creada ✅ (PENDIENTE) — 1 comprobante, 1 pedido por día",
      week_total: round2(weekTotal),
      orders: created,
      weekly_menu_id: weeklyMenuIdNum,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error al crear compra semanal:", error);
    return res.status(500).json({
      message: "No se pudo crear la compra semanal",
      error: error?.message,
    });
  }
};

export const getTodayOrders = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const todayISO = toISODateOnly(new Date());

    const orders = await Order.findAll({
      where: {
        [Op.or]: [
          { scheduled_for: todayISO },
          { scheduled_for: null, created_at: { [Op.between]: [start, end] } },
        ],
      },
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          include: [{ model: Dish, as: "dish" }],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "name", "grade", "section", "student_code"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return res.json(orders);
  } catch (err) {
    console.error("Error al obtener pedidos del día:", err);
    return res.status(500).json({ message: "Error al obtener pedidos del día" });
  }
};

export const getWeeklyOrdersByWeekday = async (req, res) => {
  try {
    const weekday = String(req.query.weekday || "").toUpperCase();

    const allowed = ["MON", "TUE", "WED", "THU", "FRI"];
    if (!allowed.includes(weekday)) {
      return res.status(400).json({ message: "weekday inválido. Usa MON|TUE|WED|THU|FRI" });
    }

    const now = new Date();
    const jsDay = now.getDay();
    const offsetFromMonday = (jsDay + 6) % 7;

    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - offsetFromMonday);

    if (jsDay === 6 || jsDay === 0) {
      monday.setDate(monday.getDate() + 7);
    }

    const map = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4 };
    const target = new Date(monday);
    target.setDate(monday.getDate() + map[weekday]);

    const targetISO = toISODateOnly(target);

    const orders = await Order.findAll({
      where: {
        scheduled_for: targetISO,
      },
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          include: [{ model: Dish, as: "dish" }],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "name", "grade", "section", "student_code"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return res.json(orders);
  } catch (err) {
    console.error("Error getWeeklyOrdersByWeekday:", err);
    return res.status(500).json({ message: "Error al obtener pedidos semanales por día" });
  }
};

export const getOrdersByWeeklyMenu = async (req, res) => {
  try {
    const weekly_menu_id = Number(req.params.weekly_menu_id);
    if (!weekly_menu_id || isNaN(weekly_menu_id) || weekly_menu_id <= 0) {
      return res.status(400).json({ message: "weekly_menu_id inválido" });
    }

    const orders = await Order.findAll({
      where: { weekly_menu_id },
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          include: [{ model: Dish, as: "dish" }],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "name", "grade", "section", "student_code"],
        },
      ],
      order: [
        ["scheduled_for", "ASC"],
        ["created_at", "ASC"],
      ],
    });

    return res.json({ weekly_menu_id, count: orders.length, orders });
  } catch (err) {
    console.error("Error getOrdersByWeeklyMenu:", err);
    return res.status(500).json({ message: "Error al obtener pedidos semanales" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ message: "No autenticado" });

    const { from, to, status, student_id, mode } = req.query;
    const where = { user_id };

    if (student_id) {
      const sid = Number(student_id);
      if (!sid || isNaN(sid) || sid <= 0) {
        return res.status(400).json({ message: "student_id inválido" });
      }
      where.student_id = sid;
    }

    if (status) {
      const allowed = ["PENDIENTE", "CONFIRMADO", "ENTREGADO"];
      if (!allowed.includes(String(status))) {
        return res.status(400).json({ message: "status inválido" });
      }
      where.status = String(status);
    }

    if (mode === "daily") where.weekly_menu_id = null;
    if (mode === "weekly") where.weekly_menu_id = { [Op.ne]: null };

    if (from || to) {
      if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
        return res.status(400).json({ message: "from debe ser YYYY-MM-DD" });
      }
      if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ message: "to debe ser YYYY-MM-DD" });
      }

      where.scheduled_for = {};
      if (from) where.scheduled_for[Op.gte] = from;
      if (to) where.scheduled_for[Op.lte] = to;
    }

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          include: [{ model: Dish, as: "dish" }],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "name", "grade", "section", "student_code"],
        },
      ],
      order: [
        ["scheduled_for", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    return res.json({ count: orders.length, orders });
  } catch (err) {
    console.error("Error getMyOrders:", err);
    return res.status(500).json({ message: "Error al obtener mis pedidos" });
  }
};

export const updateOrderStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    if (order.status !== "PENDIENTE") {
      await t.rollback();
      return res.status(400).json({ message: "El pedido ya fue procesado" });
    }

    const items = await OrderItem.findAll({
      where: { order_id: order.id },
      transaction: t,
    });

    if (!items || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "Pedido sin items (inconsistente)" });
    }

    for (const it of items) {
      const dish = await Dish.findByPk(it.dish_id, { transaction: t });
      if (!dish) {
        await t.rollback();
        return res.status(400).json({ message: "Producto no existe (inconsistente)" });
      }
      if (dish.is_active === false) {
        await t.rollback();
        return res.status(400).json({ message: `Producto inactivo: "${dish.name}"` });
      }

      const stock = Number(dish.stock ?? 0);
      const qty = Number(it.quantity ?? 0);

      if (stock < qty) {
        await t.rollback();
        return res.status(400).json({
          message: `Stock insuficiente para "${dish.name}". Disponible: ${stock}, requerido: ${qty}`,
        });
      }
    }

    for (const it of items) {
      const dish = await Dish.findByPk(it.dish_id, { transaction: t });
      dish.stock = Number(dish.stock) - Number(it.quantity);
      await dish.save({ transaction: t });
    }

    order.status = "CONFIRMADO";
    order.payment_verified_at = new Date();
    await order.save({ transaction: t });

    await t.commit();

    return res.json({
      message: "Pedido marcado como CONFIRMADO ✔ (stock actualizado)",
      order,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error al confirmar pedido:", error);
    return res.status(500).json({ message: "Error al confirmar pedido", error: error?.message });
  }
};

export const deliverOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Pedido no encontrado" });

    if (order.status !== "CONFIRMADO") {
      return res.status(400).json({ message: "Solo se puede entregar un pedido CONFIRMADO" });
    }

    order.status = "ENTREGADO";
    await order.save();

    return res.json({
      message: "Pedido marcado como ENTREGADO ✅",
      order,
    });
  } catch (error) {
    console.error("Error al entregar pedido:", error);
    return res.status(500).json({ message: "Error al entregar pedido", error: error?.message });
  }
};

export const getOrderDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "id inválido" });
    }

    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          attributes: ["id", "dish_id", "quantity", "price"],
          include: [
            {
              model: Dish,
              as: "dish",
              attributes: ["id", "name", "price", "image_path"],
            },
          ],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "name", "grade", "section", "student_code"],
        },
      ],
    });

    if (!order) return res.status(404).json({ message: "Pedido no encontrado" });

    const items = (order.orderitems || []).map((it) => ({
      id: it.id,
      dish_id: it.dish_id,
      name: it.dish?.name || "Producto",
      qty: Number(it.quantity || 0),
      price: Number(it.price || it.dish?.price || 0),
      image_path: it.dish?.image_path || null,
    }));

    return res.json({
      id: order.id,
      payment_reference: order.payment_reference,
      total: order.total,
      status: order.status,
      scheduled_for: order.scheduled_for,
      receipt_image_path: order.receipt_image_path,

      student: order.student
        ? {
          id: order.student.id,
          name: order.student.name,
          grade: order.student.grade,
          section: order.student.section,
          student_code: order.student.student_code,
        }
        : null,

      items,
    });
  } catch (err) {
    console.error("Error getOrderDetail:", err);
    return res.status(500).json({ message: "Error al obtener detalle del pedido" });
  }
};

export const getMyTodayOrder = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) return res.status(401).json({ message: "No autenticado" });

    const studentId = Number(req.query.studentId);
    if (!studentId || isNaN(studentId) || studentId <= 0) {
      return res.status(400).json({ message: "studentId inválido" });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const todayISO = toISODateOnly(new Date());

    const order = await Order.findOne({
      where: {
        user_id,
        student_id: studentId,
        [Op.or]: [
          { scheduled_for: todayISO },
          { scheduled_for: null, created_at: { [Op.between]: [start, end] } },
        ],
      },
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          include: [{ model: Dish, as: "dish" }],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "name", "grade", "section", "student_code"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json(order || null);
  } catch (err) {
    console.error("Error getMyTodayOrder:", err);
    return res.status(500).json({ message: "Error al obtener mi pedido de hoy" });
  }
};
export const getMyStudentOrders = async (req, res) => {
  try {
    const student_id = req.user?.id;
    const role = String(req.user?.role || "").toUpperCase();

    if (!student_id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (role !== "ESTUDIANTE") {
      return res.status(403).json({ message: "Acceso solo para estudiantes" });
    }

    const today = new Date();
    const todayISO = toISODateOnly(today);

    let referenceDate = new Date(today);
    if (req.query.week_start && isValidDateOnly(req.query.week_start)) {
      referenceDate = new Date(req.query.week_start + "T12:00:00");
    }

    // lunes de la semana de referencia
    const jsDay = referenceDate.getDay(); // 0 domingo, 1 lunes
    const offsetFromMonday = (jsDay + 6) % 7;

    const monday = new Date(referenceDate);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - offsetFromMonday);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const mondayISO = toISODateOnly(monday);
    const fridayISO = toISODateOnly(friday);

    const orders = await Order.findAll({
      where: {
        student_id,
        scheduled_for: {
          [Op.between]: [mondayISO, fridayISO],
        },
      },
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          include: [{ model: Dish, as: "dish" }],
        },
      ],
      order: [
        ["scheduled_for", "ASC"],
        ["created_at", "DESC"],
      ],
    });

    const todayOrders = orders
      .filter((o) => String(o.scheduled_for) === todayISO)
      .map((o) => ({
        id: o.id,
        payment_reference: o.payment_reference || null,
        total: Number(o.total || 0),
        status: o.status,
        scheduled_for: o.scheduled_for,
        items: (o.orderitems || []).map((it) => ({
          name: it.dish?.name || "Producto",
          qty: Number(it.quantity || 0),
          price: Number(it.price || 0),
        })),
      }));

    const dayMap = {
      MON: { label: "Lunes", offset: 0 },
      TUE: { label: "Martes", offset: 1 },
      WED: { label: "Miércoles", offset: 2 },
      THU: { label: "Jueves", offset: 3 },
      FRI: { label: "Viernes", offset: 4 },
    };

    const weekOrders = Object.entries(dayMap).map(([dayKey, meta]) => {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + meta.offset);

      const dateISO = toISODateOnly(currentDate);
      const dayOrders = orders.filter((o) => String(o.scheduled_for) === dateISO);

      let status = "SIN_PEDIDOS";
      let total = 0;
      const items = [];

      for (const order of dayOrders) {
        total += Number(order.total || 0);

        if (status === "SIN_PEDIDOS") status = order.status;
        if (order.status === "PENDIENTE") status = "PENDIENTE";
        else if (order.status === "CONFIRMADO" && status !== "PENDIENTE") status = "CONFIRMADO";
        else if (order.status === "ENTREGADO" && status === "SIN_PEDIDOS") status = "ENTREGADO";

        for (const it of order.orderitems || []) {
          items.push({
            name: it.dish?.name || "Producto",
            qty: Number(it.quantity || 0),
            price: Number(it.price || 0),
            status: order.status,
          });
        }
      }

      return {
        dayKey,
        dayLabel: meta.label,
        date: dateISO,
        status,
        total: dayOrders.length > 0 ? round2(total) : undefined,
        items,
      };
    });

    return res.json({
      todayOrders,
      weekOrders,
    });
  } catch (err) {
    console.error("Error getMyStudentOrders:", err);
    return res.status(500).json({
      message: "Error al obtener pedidos del estudiante",
      error: err?.message,
    });
  }
};