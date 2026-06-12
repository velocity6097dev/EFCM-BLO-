const { Pool } = require('pg');
// PASTE YOUR NEON DATABASE CONNECTION STRING BELOW
const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_ubm0XN4yKWfn@ep-plain-band-ap854c2t-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require" });

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const { date, product } = req.query;
            if (date && product) {
                // Fetch specific rate for the entry page
                const { rows } = await pool.query('SELECT rate FROM daily_prices WHERE price_date = $1 AND product = $2', [date, product]);
                return res.status(200).json({ rate: rows.length > 0 ? parseFloat(rows[0].rate) : 0 });
            } else {
                // Fetch recent prices for Admin table
                const { rows } = await pool.query('SELECT * FROM daily_prices ORDER BY price_date DESC, product ASC LIMIT 50');
                return res.status(200).json(rows);
            }
        } 
        else if (req.method === 'POST') {
            if (req.headers['x-user-role'] !== 'ADMIN') return res.status(403).json({ success: false, message: 'Admin only' });
            
            const { date, product, rate } = req.body;
            if (!date || !product || !rate) return res.status(400).json({ success: false, message: 'Missing fields' });

            await pool.query(`
                INSERT INTO daily_prices (price_date, product, rate) 
                VALUES ($1, $2, $3)
                ON CONFLICT (price_date, product) 
                DO UPDATE SET rate = EXCLUDED.rate, updated_at = CURRENT_TIMESTAMP
            `, [date, product, rate]);

            return res.status(200).json({ success: true });
        }
        res.status(405).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}