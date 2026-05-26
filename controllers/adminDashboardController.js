import { Op, fn, col } from "sequelize";
import { User } from "../models/UserModel.js";
import { Order } from "../models/OrderModel.js";
import { SchoolStudent } from "../models/SchoolStudentModel.js";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};
const endOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

export const getAdminStats = async (req, res) => {
  try {
    const monthFrom = startOfMonth();
    const monthTo = endOfMonth();
    const todayFrom = startOfToday();
    const todayTo = endOfToday();

    const totalUsers = await User.count();
    const activeStudents = await SchoolStudent.count().catch(() => 0);

    const totalOrdersMonth = await Order.count({
      where: { created_at: { [Op.between]: [monthFrom, monthTo] } },
    });

    const monthIncomeRow = await Order.findOne({
      where: {
        created_at: { [Op.between]: [monthFrom, monthTo] },
        status: "ENTREGADO",
      },
      attributes: [[fn("SUM", col("total")), "income"]],
      raw: true,
    });

    const totalIncomeMonth = Number(parseFloat(monthIncomeRow?.income || 0).toFixed(2));

    const ordersToday = await Order.count({
      where: { created_at: { [Op.between]: [todayFrom, todayTo] } },
    });

    const todayIncomeRow = await Order.findOne({
      where: {
        created_at: { [Op.between]: [todayFrom, todayTo] },
        status: "ENTREGADO",
      },
      attributes: [[fn("SUM", col("total")), "income"]],
      raw: true,
    });

    const incomeToday = Number(parseFloat(todayIncomeRow?.income || 0).toFixed(2));

    return res.json({
      totalUsers,
      activeStudents,
      totalOrdersMonth,
      totalIncomeMonth,
      ordersToday,
      incomeToday,
      monthDeltaUsersPct: null,
      todayDeltaOrdersPct: null,
    });
  } catch (err) {
    console.error("getAdminStats:", err);
    return res.status(500).json({ message: "Error stats", error: err?.message });
  }
};

export const getRecentOrders = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 6);

    const rows = await Order.findAll({
      order: [["created_at", "DESC"]],
      limit: Number.isFinite(limit) ? limit : 6,
      attributes: ["id", "total", "status", "created_at", "scheduled_for"],
      include: [
        {
          model: User, // ✅ sin alias (porque tu Order.belongsTo(User) no tiene as)
          required: false,
          attributes: ["id", "name", "email"],
        },
      ],
    });

    return res.json(
      rows.map((o) => ({
        id: o.id,
        user_name: o.User?.name || "Usuario",
        total: Number(o.total || 0),
        status: o.status,
        created_at: o.created_at,
        scheduled_for: o.scheduled_for,
      }))
    );
  } catch (err) {
    console.error("getRecentOrders:", err);
    return res.status(500).json({ message: "Error recent orders", error: err?.message });
  }
};

export const getPendingPayments = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 5);

    const rows = await Order.findAll({
      where: {
        status: "CONFIRMADO",
        receipt_image_path: { [Op.ne]: null },
      },
      order: [["created_at", "DESC"]],
      limit: Number.isFinite(limit) ? limit : 5,
      attributes: ["id", "total", "created_at", "payment_reference", "receipt_image_path", "status"],
      include: [
        {
          model: User, // ✅ sin alias
          required: false,
          attributes: ["id", "name", "email"],
        },
      ],
    });

    return res.json(
      rows.map((o) => ({
        id: o.id,
        user_name: o.User?.name || "Usuario",
        total: Number(o.total || 0),
        transfer_number: o.payment_reference || null,
        proof_url: o.receipt_image_path || null,
        created_at: o.created_at,
        status: o.status,
      }))
    );
  } catch (err) {
    console.error("getPendingPayments:", err);
    return res.status(500).json({ message: "Error pending payments", error: err?.message });
  }
};