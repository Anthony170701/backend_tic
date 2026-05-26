// models/SchoolStudentModel.js
import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const SchoolStudent = sequelize.define(
  "SchoolStudent",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    grade: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    section: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
  },
  {
    tableName: "schoolstudents",
    timestamps: false, // ✅ si tu tabla NO tiene createdAt/updatedAt
    underscored: true,
  }
);
