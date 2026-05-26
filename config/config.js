import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../env') });

export const DB_CONNECTION = process.env.DB_CONNECTION;
export const DB_HOST = process.env.DB_HOST;
export const DB_PORT = process.env.DB_PORT;
export const DB_DATABASE = process.env.DB_DATABASE;
export const DB_USERNAME = process.env.DB_USERNAME;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const PORT = process.env.PORT;
export const TOKEN_KEY = process.env.TOKEN_KEY;
export const API_KEY_DEEPSEEK = process.env.API_KEY_DEEPSEEK