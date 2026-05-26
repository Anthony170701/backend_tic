import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const WeeklyMenuItem = sequelize.define(
  "weekly_menu_items",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    weekly_menu_id: { type: DataTypes.INTEGER, allowNull: false },

    scheduled_for: { type: DataTypes.DATEONLY, allowNull: false },

    dish_id: { type: DataTypes.INTEGER, allowNull: false },

    is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    // ✅ si ya tienes snapshots en BD, déjalos aquí también:
    snapshot_name: { type: DataTypes.STRING, allowNull: true },
    snapshot_description: { type: DataTypes.TEXT, allowNull: true },
    snapshot_price: { type: DataTypes.DECIMAL(10,2), allowNull: true },
    snapshot_stock: { type: DataTypes.INTEGER, allowNull: true },
    snapshot_image_path: { type: DataTypes.STRING, allowNull: true },
    snapshot_category_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "weekly_menu_items",
    timestamps: true,

    createdAt: "created_at",
    updatedAt: false,     // ✅ NO existe updated_at en tu tabla

    // 🔥 ESTO ES CLAVE:
    // evita que sequelize intente mapear updated_at con underscored
    underscored: false,
  }
);
