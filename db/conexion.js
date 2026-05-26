import { Sequelize } from 'sequelize';
import {DB_CONNECTION, DB_USERNAME, DB_PASSWORD,DB_HOST,DB_DATABASE} from '../config/config.js';

const dialect = DB_CONNECTION || process.env.DB_CONNECTION || 'mysql';

export const sequelize = new Sequelize(
    DB_DATABASE,
    DB_USERNAME,
    DB_PASSWORD,
    {
        host: DB_HOST,
        dialect
    }
);
















