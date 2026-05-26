import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const Order = sequelize.define("orders", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  // 🔗 NUEVO: pedido semanal (NULL = pedido diario)
  weekly_menu_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },

  payment_reference: {
    type: DataTypes.STRING(120),
    allowNull: true
  },

  receipt_image_path: {
    type: DataTypes.STRING,
    allowNull: true
  },

  payment_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // ✅ ESTADOS DEFINITIVOS
  status: {
    type: DataTypes.ENUM("PENDIENTE", "CONFIRMADO", "ENTREGADO"),
    allowNull: false,
    defaultValue: "PENDIENTE"
  },

  scheduled_for: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },

  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }

}, {
  timestamps: false,
  tableName: "orders"
});
