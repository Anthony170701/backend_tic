import { sequelize } from '../db/conexion.js';
import { QueryTypes } from 'sequelize';

async function ensureVisibleFrom() {
  try {
    // Check if column exists
    const [results] = await sequelize.query(
      "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = :db AND TABLE_NAME = 'weekly_menus' AND COLUMN_NAME = 'visible_from';",
      {
        replacements: { db: process.env.DB_DATABASE || process.env.DB_DATABASE || 'test' },
        type: QueryTypes.SELECT,
      }
    );

    const exists = results && (results.cnt || results.CNT || results.COUNT || results.count || Object.values(results)[0]);

    if (Number(exists) > 0) {
      console.log('Column visible_from already exists — nothing to do.');
      process.exit(0);
    }

    console.log('Adding visible_from column to weekly_menus...');
    await sequelize.query("ALTER TABLE `weekly_menus` ADD COLUMN `visible_from` DATE NULL;");
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

ensureVisibleFrom();
