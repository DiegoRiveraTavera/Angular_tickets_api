require('dotenv').config()
const fastify = require('fastify')({ logger: true })
fastify.register(require('@fastify/cors'), { origin: '*' })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const { logRequest, logError } = require('./logger')

// ✅ Hook: registra cada request
fastify.addHook('onRequest', async (req) => {
  req.startTime = Date.now()
})

fastify.addHook('onResponse', async (req, res) => {
  await logRequest({
    method: req.method,
    endpoint: req.url,
    ip: req.ip,
    statusCode: res.statusCode,
    responseTimeMs: Date.now() - (req.startTime || Date.now())
  })
})

fastify.addHook('onError', async (req, res, error) => {
  await logError({
    method: req.method,
    endpoint: req.url,
    ip: req.ip,
    statusCode: res.statusCode,
    errorMessage: error.message,
    stackTrace: error.stack
  })
})

// GET /
fastify.get('/', async (req, res) => {
  const result = await pool.query(`
    SELECT t.*, u1.name as created_by_name, u2.name as assigned_to_name
    FROM tickets t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.assigned_to = u2.id
  `)
  return result.rows
})

// ✅ ANTES de /:id para que no haya conflicto
fastify.get('/user/:userId', async (req, res) => {
  const result = await pool.query(`
    SELECT t.*, u2.name as assigned_to_name
    FROM tickets t
    LEFT JOIN users u2 ON t.assigned_to = u2.id
    WHERE t.assigned_to = $1
    ORDER BY t.created_at DESC
  `, [req.params.userId])
  return result.rows
})

fastify.get('/group/:groupId', async (req, res) => {
  const result = await pool.query(`
    SELECT t.*, u1.name as created_by_name, u2.name as assigned_to_name
    FROM tickets t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.assigned_to = u2.id
    WHERE t.group_id = $1
  `, [req.params.groupId])
  return result.rows
})

fastify.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id])
  if (!result.rows[0]) return res.status(404).send({ message: 'Ticket no encontrado' })
  return result.rows[0]
})

fastify.post('/', async (req, res) => {
  const {
    title, description,
    status = 'abierto',
    priority = 'media',
    created_by = null,
    assigned_to = null,
    group_id,
    due_date = null 
  } = req.body

  const result = await pool.query(
    `INSERT INTO tickets (title, description, status, priority, created_by, assigned_to, group_id, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [title, description, status, priority, created_by, assigned_to, group_id, due_date]
  )
  return res.status(201).send(result.rows[0])
})

fastify.put('/:id', async (req, res) => {
  const { title, description, status, priority, assigned_to, due_date = null } = req.body  // ← agregar
  const result = await pool.query(
    `UPDATE tickets SET title=$1, description=$2, status=$3, priority=$4, assigned_to=$5, due_date=$6, updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [title, description, status, priority, assigned_to, due_date, req.params.id]  // ← $6 y $7
  )
  if (!result.rows[0]) return res.status(404).send({ message: 'Ticket no encontrado' })
  return result.rows[0]
})

fastify.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  const result = await pool.query(
    `UPDATE tickets SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [status, req.params.id]
  )
  if (!result.rows[0]) return res.status(404).send({ message: 'Ticket no encontrado' })
  return result.rows[0]
})

fastify.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM tickets WHERE id=$1 RETURNING id', [req.params.id])
  if (!result.rows[0]) return res.status(404).send({ message: 'Ticket no encontrado' })
  return { message: 'Ticket eliminado' }
})

fastify.listen({ port: process.env.PORT }, () => {
  console.log(`Tickets API en puerto ${process.env.PORT}`)
})