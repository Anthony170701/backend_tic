import { DataTypes } from "sequelize";
import { sequelize } from "../db/conexion.js";

export const WeeklyMenu = sequelize.define(
  "weekly_menus",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    week_start: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true, // una semana = un menú
    },

    // ✅ NUEVO: estado del menú
    // DRAFT = borrador editable por el bar
    // PUBLISHED = menú publicado
    status: {
      type: DataTypes.ENUM("DRAFT", "PUBLISHED"),
      allowNull: false,
      defaultValue: "DRAFT",
    },
    published_at: {
  type: DataTypes.DATE,
  allowNull: true,
},
    // Fecha desde la cual este menú debe ser visible para los padres
    visible_from: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false, // users.id (BAR)
    },

    // ✅ IMPORTANTE:
    // 1 = menú activo que ven los padres (solo debe haber uno activo publicado)
    // 0 = no activo (borrador o menús viejos)
    is_active: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0, // ✅ por defecto NO activo
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false, // ✅ porque manejamos created_at/updated_at manual
    tableName: "weekly_menus",
  }
);
