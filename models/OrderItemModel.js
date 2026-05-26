import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const OrderItem = sequelize.define("orderitems", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  dish_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  // ✅ NUEVO: para saber para qué estudiante es el producto
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }

}, {
  timestamps: false,
  tableName: "orderitems"
});