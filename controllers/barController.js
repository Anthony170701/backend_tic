import { Op } from "sequelize";
import { User } from "../models/UserModel.js";
import { Order } from "../models/OrderModel.js";
import { OrderItem } from "../models/OrderItemModel.js";
import { Dish } from "../models/DishModel.js";

const startEndOfToday = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const todayISO = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// GET /bar/student/:code/pending
// ✅ Busca por student_code
// ✅ Trae pedidos del día real
// ✅ Incluye PENDIENTE y CONFIRMADO
export const getPendingByStudentCode = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();

    const student = await User.findOne({
      where: {
        student_code: code,
        role: "ESTUDIANTE",
        status: "active",
      },
      attributes: ["id", "name", "student_code", "grade", "section"],
    });

    if (!student) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }

    const { start, end } = startEndOfToday();
    const today = todayISO();

    const orders = await Order.findAll({
      where: {
        student_id: student.id,
        status: {
          [Op.in]: ["PENDIENTE", "CONFIRMADO"],
        },
        [Op.or]: [
          { scheduled_for: today },
          {
            scheduled_for: null,
            created_at: { [Op.between]: [start, end] },
          },
        ],
      },
      order: [
        ["status", "ASC"], // PENDIENTE primero, luego CONFIRMADO
        ["id", "DESC"],
      ],
      include: [
        {
          model: OrderItem,
          as: "orderitems",
          include: [
            {
              model: Dish,
              as: "dish",
              attributes: ["id", "name", "price", "image_path"],
            },
          ],
        },
      ],
    });

    // ✅ Resumen consolidado por producto
    const summary = {};

    for (const order of orders) {
      for (const item of order.orderitems || []) {
        const name = item.dish?.name || "Producto";
        const qty = Number(item.quantity || 0);

        if (!summary[name]) {
          summary[name] = 0;
        }

        summary[name] += qty;
      }
    }

    return res.json({
      student,
      count: orders.length,
      orders,
      summary,
      has_pending: orders.some((o) => o.status === "PENDIENTE"),
      has_confirmed: orders.some((o) => o.status === "CONFIRMADO"),
    });
  } catch (error) {
    console.error("Error getPendingByStudentCode:", error);
    return res.status(500).json({ message: "Error consultando pendientes" });
  }
};

// POST /bar/orders/:id/deliver
// ✅ Entrega un pedido puntual en estado CONFIRMADO
export const deliverOrder = async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "ID de pedido inválido" });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    if (order.status !== "CONFIRMADO") {
      return res.status(400).json({
        message: "El pedido no está CONFIRMADO para entrega",
      });
    }

    await order.update({ status: "ENTREGADO" });

    return res.json({
      message: "Pedido entregado correctamente",
      orderId,
    });
  } catch (error) {
    console.error("Error deliverOrder:", error);
    return res.status(500).json({ message: "Error entregando pedido" });
  }
};

// POST /bar/student/:code/deliver-all
// ✅ Entrega todos los pedidos CONFIRMADOS del día para ese estudiante
export const deliverAllTodayByStudentCode = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();

    const student = await User.findOne({
      where: {
        student_code: code,
        role: "ESTUDIANTE",
        status: "active",
      },
      attributes: ["id", "name", "student_code"],
    });

    if (!student) {
      return res.status(404).json({ message: "Estudiante no encontrado" });
    }

    const { start, end } = startEndOfToday();
    const today = todayISO();

    const [updated] = await Order.update(
      { status: "ENTREGADO" },
      {
        where: {
          student_id: student.id,
          status: "CONFIRMADO",
          [Op.or]: [
            { scheduled_for: today },
            {
              scheduled_for: null,
              created_at: { [Op.between]: [start, end] },
            },
          ],
        },
      }
    );

    return res.json({
      message: "Entregas realizadas correctamente",
      updated_orders: updated,
      student: {
        id: student.id,
        name: student.name,
        student_code: student.student_code,
      },
    });
  } catch (error) {
    console.error("Error deliverAllTodayByStudentCode:", error);
    return res.status(500).json({ message: "Error entregando todo" });
  }
};