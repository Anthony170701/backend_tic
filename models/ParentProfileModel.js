// models/ParentProfileModel.js
import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const ParentProfile = sequelize.define(
  "ParentProfile",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // opcionales (pon los que tengas en tu tabla)
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "parentprofiles",
    timestamps: false, // ✅ si tu tabla NO tiene createdAt/updatedAt
    underscored: true,
  }
);
