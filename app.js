require('dotenv').config()
const fastify = require('fastify')({ logger: true })
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

fastify.get('/tickets', async (request, reply) => {
  const result = await pool.query('SELECT * FROM tickets')
  return result.rows
})

const start = async () => {
  await fastify.listen({ port: process.env.PORT })
}

start()