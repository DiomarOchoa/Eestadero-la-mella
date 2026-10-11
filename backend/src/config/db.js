const { Pool } = require('pg');
require('dotenv').config();

// Pool centralizado de conexiones a PostgreSQL.
// Se reutiliza en toda la aplicación para evitar abrir una conexión por request.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS) || 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS) || 10000,
  // Render inyecta la variable RENDER=true automáticamente en producción.
  // Solo activamos SSL ahí, para no romper la conexión en local.
  ssl: process.env.RENDER ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Errores inesperados en clientes inactivos del pool (no deben tumbar el proceso)
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

/**
 * Ejecuta una consulta simple usando el pool.
 * @param {string} text - Consulta SQL parametrizada ($1, $2, ...)
 * @param {Array} params - Parámetros de la consulta
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtiene un cliente dedicado del pool para ejecutar transacciones
 * (BEGIN / COMMIT / ROLLBACK) de forma segura.
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
