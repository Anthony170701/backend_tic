import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const Dish = sequelize.define(
  "dishes",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    image_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    category_id: {
  type: DataTypes.INTEGER,
  allowNull: true, // si quieres obligarlo luego lo cambiamos a false
},

    // 🔥 NUEVO CAMPO IMPORTANTE PARA TU PLATAFORMA
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0, // stock inicial
    },

    // 🔥 Ya lo tenías, sirve para ocultar productos agotados si quieres
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: false,
    tableName: "dishes",
  }
);
