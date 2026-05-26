import { Op, fn, col, literal, QueryTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

import { Order } from "../models/OrderModel.js";
import { OrderItem } from "../models/OrderItemModel.js";
import { Dish } from "../models/DishModel.js";
import { User } from "../models/UserModel.js";

// ==============================
// Helpers
// ==============================
const isValidDateOnly = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const toISODateOnly = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Lunes->Viernes (semana actual). Si es Sáb/Dom, semana siguiente.
const getWeekRangeMonFri = () => {
  const now = new Date();
  const jsDay = now.getDay(); // 0 dom, 1 lun, ... 6 sab

  const offsetFromMonday = (jsDay + 6) % 7;

  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - offsetFromMonday);

  if (jsDay === 6 || jsDay === 0) {
    monday.setDate(monday.getDate() + 7);
  }

  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);

  return { from: toISODateOnly(monday), to: toISODateOnly(friday) };
};

// =====================================================
// GET /api/admin/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
// Ventas por rango (scheduled_for o fallback created_at)
// =====================================================
export const reportSalesByDateRange = async (req, res) => {
  try {
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({
        message: "Parámetros inválidos. Usa from=YYYY-MM-DD&to=YYYY-MM-DD",
      });
    }

    const fromDT = new Date(`${from}T00:00:00`);
    const toDT = new Date(`${to}T23:59:59.999`);

    const where = {
      [Op.or]: [
        { scheduled_for: { [Op.between]: [from, to] } },
        { scheduled_for: null, created_at: { [Op.between]: [fromDT, toDT] } },
      ],
    };

    const row = await Order.findOne({
      where,
      attributes: [
        [fn("COUNT", col("id")), "totalOrders"],
        [fn("SUM", literal(`CASE WHEN status = 'PENDIENTE' THEN 1 ELSE 0 END`)), "pendingOrders"],
        [fn("SUM", literal(`CASE WHEN status = 'CONFIRMADO' THEN 1 ELSE 0 END`)), "confirmedOrders"],
        [fn("SUM", literal(`CASE WHEN status = 'ENTREGADO' THEN 1 ELSE 0 END`)), "deliveredOrders"],
        [fn("SUM", literal(`CASE WHEN status = 'CONFIRMADO' THEN total ELSE 0 END`)), "incomeConfirmed"],
        [fn("SUM", literal(`CASE WHEN status = 'ENTREGADO' THEN total ELSE 0 END`)), "incomeDelivered"],
      ],
      raw: true,
    });

    const out = {
      from,
      to,
      totalOrders: Number(row?.totalOrders || 0),
      pendingOrders: Number(row?.pendingOrders || 0),
      confirmedOrders: Number(row?.confirmedOrders || 0),
      deliveredOrders: Number(row?.deliveredOrders || 0),
      incomeConfirmed: Number(parseFloat(row?.incomeConfirmed || 0).toFixed(2)),
      incomeDelivered: Number(parseFloat(row?.incomeDelivered || 0).toFixed(2)),
    };

    return res.json(out);
  } catch (err) {
    console.error("reportSalesByDateRange:", err);
    return res.status(500).json({ message: "Error generando reporte", error: err?.message });
  }
};

// =====================================================
// GET /api/admin/reports/weekly-bars?from=YYYY-MM-DD&to=YYYY-MM-DD
// Pedidos e Ingresos Semanales (Lun-Vie)
// - Pedidos: cuenta TODOS
// - Ingresos: suma SOLO ENTREGADO
// =====================================================
export const reportWeeklyBars = async (req, res) => {
  try {
    let from = String(req.query.from || "").trim();
    let to = String(req.query.to || "").trim();

    if (!from || !to) {
      const r = getWeekRangeMonFri();
      from = r.from;
      to = r.to;
    }

    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({ message: "Parámetros inválidos. Usa from/to YYYY-MM-DD" });
    }

    const fromDT = new Date(`${from}T00:00:00`);
    const toDT = new Date(`${to}T23:59:59.999`);

    const dayExpr = `COALESCE(scheduled_for, DATE(created_at))`;
    const weekdayExpr = literal(`WEEKDAY(${dayExpr})`); // MySQL: 0=Lun..4=Vie

    const rows = await Order.findAll({
      where: {
        [Op.or]: [
          { scheduled_for: { [Op.between]: [from, to] } },
          { scheduled_for: null, created_at: { [Op.between]: [fromDT, toDT] } },
        ],
      },
      attributes: [
        [weekdayExpr, "weekday"],
        [fn("COUNT", col("id")), "orders"],
        [fn("SUM", literal(`CASE WHEN status='ENTREGADO' THEN total ELSE 0 END`)), "income"],
      ],
      group: [weekdayExpr],
      raw: true,
    });

    const base = [
      { key: "MON", label: "Lun", weekday: 0, orders: 0, income: 0 },
      { key: "TUE", label: "Mar", weekday: 1, orders: 0, income: 0 },
      { key: "WED", label: "Mié", weekday: 2, orders: 0, income: 0 },
      { key: "THU", label: "Jue", weekday: 3, orders: 0, income: 0 },
      { key: "FRI", label: "Vie", weekday: 4, orders: 0, income: 0 },
    ];

    for (const r of rows) {
      const wd = Number(r.weekday);
      const idx = base.findIndex((x) => x.weekday === wd);
      if (idx >= 0) {
        base[idx].orders = Number(r.orders || 0);
        base[idx].income = Number(parseFloat(r.income || 0).toFixed(2));
      }
    }

    return res.json({ from, to, days: base });
  } catch (err) {
    console.error("reportWeeklyBars:", err);
    return res.status(500).json({ message: "Error weekly-bars", error: err?.message });
  }
};

// =====================================================
// ✅ GET /api/admin/reports/top-products?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=5
// Productos más vendidos (ENTREGADO) estilo Figma
// ✅ versión segura con SQL directo
// =====================================================
export const reportTopProducts = async (req, res) => {
  try {
    let from = String(req.query.from || "").trim();
    let to = String(req.query.to || "").trim();
    const limit = Number(req.query.limit || 5);

    if (!from || !to) {
      const r = getWeekRangeMonFri();
      from = r.from;
      to = r.to;
    }

    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({
        message: "Parámetros inválidos. Usa from/to YYYY-MM-DD",
      });
    }

    const fromDT = `${from} 00:00:00`;
    const toDT = `${to} 23:59:59`;

    const safeLimit =
      Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : 5;

    const [rows] = await sequelize.query(`
  SELECT
    d.id AS dish_id,
    d.name AS name,
    SUM(oi.quantity) AS units
  FROM orderitems oi
  INNER JOIN orders o ON o.id = oi.order_id
  INNER JOIN dishes d ON d.id = oi.dish_id
  WHERE o.status = 'ENTREGADO'
    AND (
      (o.scheduled_for BETWEEN :from AND :to)
      OR
      (o.scheduled_for IS NULL AND o.created_at BETWEEN :fromDT AND :toDT)
    )
  GROUP BY d.id, d.name
  ORDER BY units DESC
  LIMIT :limit
`, {
      replacements: {
        from,
        to,
        fromDT: `${from} 00:00:00`,
        toDT: `${to} 23:59:59`,
        limit: safeLimit,
      },
    });
    const products = (rows || []).map((r) => ({
      dish_id: Number(r.dish_id || 0),
      name: String(r.name || "Producto"),
      units: Number(r.units || 0),
    }));

    return res.json({ from, to, products });
  } catch (err) {
    console.error("reportTopProducts:", err);
    return res.status(500).json({
      message: "Error top-products",
      error: err?.message,
    });
  }
};

// =====================================================
// GET /api/admin/reports/grade-distribution?from=YYYY-MM-DD&to=YYYY-MM-DD
// Distribución por grado (estudiantes únicos con pedidos ENTREGADO)
// ✅ Usa users porque orders.student_id apunta a users.id
// =====================================================
export const reportGradeDistribution = async (req, res) => {
  try {
    let from = String(req.query.from || "").trim();
    let to = String(req.query.to || "").trim();

    if (!from || !to) {
      const r = getWeekRangeMonFri();
      from = r.from;
      to = r.to;
    }

    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({
        message: "Parámetros inválidos. Usa from/to YYYY-MM-DD",
      });
    }

    const rows = await sequelize.query(
      `
      SELECT
        CONCAT(
          COALESCE(u.grade, 'Sin grado'),
          CASE
            WHEN u.section IS NOT NULL AND u.section <> '' THEN CONCAT(' ', u.section)
            ELSE ''
          END
        ) AS grade,
        COUNT(DISTINCT o.student_id) AS students
      FROM orders o
      INNER JOIN users u ON u.id = o.student_id
      WHERE o.status = 'ENTREGADO'
        AND COALESCE(o.scheduled_for, DATE(o.created_at)) BETWEEN :from AND :to
      GROUP BY
        COALESCE(u.grade, 'Sin grado'),
        COALESCE(u.section, '')
      ORDER BY students DESC
      `,
      {
        replacements: { from, to },
        type: QueryTypes.SELECT,
      }
    );

    const grades = rows.map((r) => ({
      grade: String(r.grade || "Sin grado"),
      students: Number(r.students || 0),
    }));

    return res.json({ from, to, grades });
  } catch (err) {
    console.error("reportGradeDistribution:", err);
    return res.status(500).json({
      message: "Error grade-distribution",
      error: err?.message,
    });
  }
};
// =====================================================
// GET /api/admin/reports/export-all?from=YYYY-MM-DD&to=YYYY-MM-DD
// Exporta CSV detallado (Excel-friendly con sep=; y BOM)
// =====================================================
export const exportAllCsv = async (req, res) => {
  try {
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
      return res.status(400).json({
        message: "Parámetros inválidos. Usa from=YYYY-MM-DD&to=YYYY-MM-DD",
      });
    }

    const fromDT = new Date(`${from}T00:00:00`);
    const toDT = new Date(`${to}T23:59:59.999`);

    const where = {
      [Op.or]: [
        { scheduled_for: { [Op.between]: [from, to] } },
        { scheduled_for: null, created_at: { [Op.between]: [fromDT, toDT] } },
      ],
    };

    const orders = await Order.findAll({
      where,
      order: [["created_at", "ASC"]],
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          required: false,
          include: [{ model: Dish, as: "dish", required: false }],
        },
        {
          model: User,
          as: "student",
          required: false,
        },
      ],
    });

    const header = [
      "Pedido ID",
      "Fecha Agendada",
      "Fecha Creacion",
      "Estado",
      "Total Pedido",
      "Estudiante Codigo",
      "Estudiante Nombre",
      "Estudiante Grado",
      "Producto ID",
      "Producto Nombre",
      "Cantidad",
      "Precio Unitario",
      "Subtotal Producto",
    ];

    const rows = [header];

    for (const o of orders) {
      const base = [
        o.id ?? "",
        o.scheduled_for ?? "",
        o.created_at ? new Date(o.created_at).toISOString().replace("T", " ").substring(0, 19) : "",
        o.status ?? "",
        o.total ? String(o.total).replace(".", ",") : "0",
        o.student?.student_code ?? o.student_id ?? "",
        o.student?.name ?? "",
        `${o.student?.grade || ""} ${o.student?.section || ""}`.trim(),
      ];

      const items = Array.isArray(o.orderitems) ? o.orderitems : [];

      if (items.length === 0) {
        rows.push([...base, "", "", "", "", ""]);
        continue;
      }

      for (const it of items) {
        const dish = it.dish;
        const qty = Number(it.quantity || 0);
        const price = Number(it.price || 0);
        const subtotal = Number((qty * price).toFixed(2));

        rows.push([
          ...base,
          dish?.id ?? it.dish_id ?? "",
          dish?.name ?? "",
          qty,
          String(price).replace(".", ","),
          String(subtotal).replace(".", ","),
        ]);
      }
    }

    const delimiter = ";";
    const escape = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

    const csv = "sep=;\r\n" + rows
      .map((r) => r.map(escape).join(delimiter))
      .join("\r\n");

    const filename = `reporte_general_${from}_a_${to}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send("\uFEFF" + csv);
  } catch (err) {
    console.error("exportAllCsv:", err);
    return res.status(500).json({ message: "Error exportando CSV", error: err?.message });
  }
};