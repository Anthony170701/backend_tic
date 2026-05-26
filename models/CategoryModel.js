import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const Category = sequelize.define(
  "categories",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    name: { type: DataTypes.STRING(80), allowNull: false, unique: true },

    description: { type: DataTypes.STRING(255), allowNull: true },

    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    timestamps: false,
    tableName: "categories",
  }
);
