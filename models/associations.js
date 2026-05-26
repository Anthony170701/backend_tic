import { User } from "./UserModel.js";
import { Dish } from "./DishModel.js";
import { Order } from "./OrderModel.js";
import { OrderItem } from "./OrderItemModel.js";
import { Category } from "./CategoryModel.js";
import { ParentProfile } from "./ParentProfileModel.js";

// ✅ MENÚ SEMANAL
import { WeeklyMenu } from "./WeeklyMenuModel.js";
import { WeeklyMenuItem } from "./WeeklyMenuItemModel.js";

export const setupAssociations = () => {
  // ==========================
  //   USUARIO -> PEDIDOS (quien compra: padre/admin)
  // ==========================
  User.hasMany(Order, { foreignKey: "user_id", as: "orders" });
  Order.belongsTo(User, { foreignKey: "user_id", as: "user" });

  // ==========================
  //   ESTUDIANTE (User) -> PEDIDOS
  //   orders.student_id apunta a users.id
  // ==========================
  User.hasMany(Order, { foreignKey: "student_id", as: "studentOrders" });
  Order.belongsTo(User, { foreignKey: "student_id", as: "student" });

  // ==========================
  //   PEDIDO -> ITEMS
  // ==========================
  Order.hasMany(OrderItem, { foreignKey: "order_id", as: "orderitems" });
  OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });

  // ==========================
  //   PLATO -> ITEMS
  // ==========================
  Dish.hasMany(OrderItem, { foreignKey: "dish_id", as: "orderItems" });
  OrderItem.belongsTo(Dish, { foreignKey: "dish_id", as: "dish" });

  // ==========================
  //   CATEGORIA -> PLATOS
  // ==========================
  Category.hasMany(Dish, { foreignKey: "category_id", as: "dishes" });
  Dish.belongsTo(Category, { foreignKey: "category_id", as: "category" });

  // ==========================
  //   PADRE -> PERFIL
  // ==========================
  User.hasOne(ParentProfile, { foreignKey: "user_id", as: "parentProfile" });
  ParentProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

  // ==========================
  //   PADRE (User) -> HIJOS (Users ESTUDIANTE)
  //   users.parent_id apunta al id del padre
  // ==========================
  User.hasMany(User, { foreignKey: "parent_id", as: "children" });
  User.belongsTo(User, { foreignKey: "parent_id", as: "parent" });

  // ==========================================================
  //   MENÚ SEMANAL: WeeklyMenu y WeeklyMenuItem
  // ==========================================================
  WeeklyMenu.hasMany(WeeklyMenuItem, {
    foreignKey: "weekly_menu_id",
    as: "items",
  });

  WeeklyMenuItem.belongsTo(WeeklyMenu, {
    foreignKey: "weekly_menu_id",
    as: "weeklyMenu",
  });

  // WeeklyMenuItem -> Dish
  Dish.hasMany(WeeklyMenuItem, {
    foreignKey: "dish_id",
    as: "menuItems",
  });

  WeeklyMenuItem.belongsTo(Dish, {
    foreignKey: "dish_id",
    as: "dish",
  });

  // Quién creó el menú
  User.hasMany(WeeklyMenu, {
    foreignKey: "created_by",
    as: "weeklyMenus",
  });

  WeeklyMenu.belongsTo(User, {
    foreignKey: "created_by",
    as: "creator",
  });

  // ==========================================================
  //   ORDER -> WEEKLY MENU
  // ==========================================================
  WeeklyMenu.hasMany(Order, {
    foreignKey: "weekly_menu_id",
    as: "orders",
  });

  Order.belongsTo(WeeklyMenu, {
    foreignKey: "weekly_menu_id",
    as: "weeklyMenu",
  });
};