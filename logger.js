const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown'

async function logRequest({ method, endpoint, userId, ip, statusCode, responseTimeMs }) {
  try {
    await pool.query(
      `INSERT INTO request_logs (service, method, endpoint, user_id, ip, status_code, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [SERVICE_NAME, method, endpoint, userId || null, ip, statusCode, responseTimeMs]
    )
    await updateMetrics({ method, endpoint, responseTimeMs })
  } catch (err) {
    console.error('Error guardando log:', err.message)
  }
}

async function logError({ method, endpoint, userId, ip, statusCode, errorMessage, stackTrace }) {
  try {
    await pool.query(
      `INSERT INTO error_logs (service, method, endpoint, user_id, ip, status_code, error_message, stack_trace)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [SERVICE_NAME, method, endpoint, userId || null, ip, statusCode, errorMessage, stackTrace || null]
    )
  } catch (err) {
    console.error('Error guardando error_log:', err.message)
  }
}

async function updateMetrics({ method, endpoint, responseTimeMs }) {
  try {
    const time = parseInt(responseTimeMs) || 0

    await pool.query(
      `INSERT INTO endpoint_metrics (service, method, endpoint, request_count, total_response_time_ms, avg_response_time_ms, last_called)
       VALUES ($1, $2, $3, 1, $4::bigint, $5::numeric, NOW())
       ON CONFLICT ON CONSTRAINT endpoint_metrics_unique DO UPDATE SET
         request_count = endpoint_metrics.request_count + 1,
         total_response_time_ms = endpoint_metrics.total_response_time_ms + $6::bigint,
         avg_response_time_ms = (endpoint_metrics.total_response_time_ms + $7::numeric) / (endpoint_metrics.request_count + 1),
         last_called = NOW()`,
      [SERVICE_NAME, method, endpoint, time, time, time, time]
    )
  } catch (err) {
    console.error('Error actualizando métricas:', err.message)
  }
}

module.exports = { logRequest, logError }