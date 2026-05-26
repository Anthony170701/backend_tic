import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const User = sequelize.define(
  "users",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },

    // ✅ NUEVO: código del estudiante (para QR / entrega)
    student_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING(120),
      unique: true,
      allowNull: false,
      validate: { isEmail: true },
    },

    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    role: {
      type: DataTypes.ENUM("ADMIN", "BAR", "PADRE", "ESTUDIANTE"),
      allowNull: false,
      defaultValue: "PADRE",
    },

    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },

    must_change_password: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // grado del estudiante
    grade: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // paralelo
    section: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
  },
  {
    timestamps: false,
    tableName: "users",
  }
);