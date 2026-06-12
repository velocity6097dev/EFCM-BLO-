const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_WeBqunU56xPX@ep-lucky-cloud-aozli1uh.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" });

module.exports = async function handler(req, res) {
    const userRole = req.headers['x-user-role'];
    if (userRole !== 'ADMIN') return res.status(403).json({ success: false, message: 'Admin only' });

    if (req.method === 'GET') {
        const { rows } = await pool.query('SELECT * FROM blocked_entities ORDER BY created_at DESC');
        return res.status(200).json(rows);
    } 
    else if (req.method === 'POST') {
        const { blockType, blockValue, reason } = req.body;
        await pool.query(`INSERT INTO blocked_entities (block_type, block_value, reason, blocked_by) VALUES ($1, $2, $3, 'ADMIN') ON CONFLICT DO NOTHING`, [blockType, blockValue, reason]);
        return res.status(201).json({ success: true });
    } 
    else if (req.method === 'DELETE') {
        await pool.query('DELETE FROM blocked_entities WHERE id = $1', [req.body.id]);
        return res.status(200).json({ success: true });
    }
}