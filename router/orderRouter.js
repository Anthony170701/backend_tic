import { Router } from "express";
import { verifyToken, checkRole } from "../middleware/auth.js";
import { uploadToMemory } from "../middleware/uploadMiddleware.js";

import {
  createOrder,
  createWeeklyOrders,
  getTodayOrders,
  updateOrderStatus,
  deliverOrderStatus,
  getOrdersByWeeklyMenu,
  getMyOrders,
  getWeeklyOrdersByWeekday,
  getOrderDetail, 
  getMyTodayOrder,
  getMyStudentOrders,

} from "../controllers/OrderController.js";

export const orderRouter = Router();

// 🟢 PADRE/PARENT/ADMIN: pedido diario
orderRouter.post(
  "/orders",
  verifyToken,
  checkRole("PADRE", "PARENT", "ADMIN"),
  uploadToMemory.single("receipt_image"),
  createOrder
);

// 🟢 PADRE/PARENT/ADMIN: pedido semanal
orderRouter.post(
  "/orders/weekly",
  verifyToken,
  checkRole("PADRE", "PARENT", "ADMIN"),
  uploadToMemory.single("receipt_image"),
  createWeeklyOrders
);

// 🟢 PADRE/PARENT/ADMIN: ver mis pedidos (con filtros)
orderRouter.get(
  "/orders/mine",
  verifyToken,
  checkRole("PADRE", "PARENT", "ADMIN"),
  getMyOrders
);

// 🔵 BAR/ADMIN: pedidos de hoy
orderRouter.get(
  "/orders/today",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  getTodayOrders
);
orderRouter.get(
  "/orders/weekly",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  getWeeklyOrdersByWeekday
);

// 🔵 BAR/ADMIN: pedidos por menú semanal
orderRouter.get(
  "/orders/weekly/:weekly_menu_id",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  getOrdersByWeeklyMenu
);

// 🔵 BAR/ADMIN: confirmar pedido
orderRouter.patch(
  "/orders/:id/confirm",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  updateOrderStatus
);

// 🔵 BAR/ADMIN: entregar pedido
orderRouter.patch(
  "/orders/:id/deliver",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  deliverOrderStatus
);
// 🔵 BAR/ADMIN: detalle de pedido (para ver qué entregar)
orderRouter.get(
  "/orders/:id/detail",
  verifyToken,
  checkRole("BAR", "ADMIN"),
  getOrderDetail
);
// 🟢 PADRE/PARENT/ADMIN: ver mi pedido de HOY (por estudiante)
// 🟢 PADRE/PARENT/ADMIN: ver mi pedido de HOY (por estudiante)
orderRouter.get(
  "/orders/my-today",
  verifyToken,
  checkRole("PADRE", "PARENT", "ADMIN"),
  getMyTodayOrder
);

// 🟣 ESTUDIANTE: ver sus pedidos (hoy + semana)
orderRouter.get(
  "/orders/student/me/orders",
  verifyToken,
  checkRole("ESTUDIANTE"),
  getMyStudentOrders
);

export default orderRouter;
