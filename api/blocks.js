const pool = require('./_lib/db');

module.exports = async function handler(req, res) {
    const userRole = req.headers['x-user-role'];
    if (userRole !== 'ADMIN') return res.status(403).json({ success: false, message: 'Admin only' });

    try {
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
        res.status(405).end();
    } catch (error) {
        console.error("Blocks API Error:", error);
        res.status(500).json({ success: false, message: "Database connection error." });
    }
}