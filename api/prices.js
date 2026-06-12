const pool = require('./_lib/db');

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const { date, product } = req.query;
            if (date && product) {
                // Fetch specific rate for the entry page:
                // Looks for the price on the EXACT date, or the closest PREVIOUS date if not found.
                const { rows } = await pool.query(
                    'SELECT rate FROM daily_prices WHERE price_date <= $1::date AND product = $2 ORDER BY price_date DESC LIMIT 1',
                    [date, product]
                );

                return res.status(200).json({ rate: rows.length > 0 ? parseFloat(rows[0].rate) : 0 });
            } else {
                // Fetch recent prices for Admin table
                // 🚀 DATE FIX: format price_date as text in SQL (to_char) so the
                // admin page no longer needs its own JS timezone workaround.
                const { rows } = await pool.query(`
                    SELECT *, to_char(price_date, 'YYYY-MM-DD') AS price_date_str
                    FROM daily_prices
                    ORDER BY price_date DESC, product ASC
                    LIMIT 50
                `);
                return res.status(200).json(rows.map(r => ({
                    ...r,
                    price_date: r.price_date_str
                })));
            }
        }
        else if (req.method === 'POST') {
            if (req.headers['x-user-role'] !== 'ADMIN') return res.status(403).json({ success: false, message: 'Admin only' });

            const { date, product, rate } = req.body;
            if (!date || !product || !rate) return res.status(400).json({ success: false, message: 'Missing fields' });

            // 🚀 DATE FIX: cast to ::date so it's stored as a calendar date,
            // not a timestamptz with a timezone-shifted day.
            await pool.query(`
                INSERT INTO daily_prices (price_date, product, rate) 
                VALUES ($1::date, $2, $3)
                ON CONFLICT (price_date, product) 
                DO UPDATE SET rate = EXCLUDED.rate, updated_at = CURRENT_TIMESTAMP
            `, [date, product, rate]);

            return res.status(200).json({ success: true });
        }
        res.status(405).end();
    } catch (error) {
        console.error("Prices API Error:", error);
        res.status(500).json({ error: error.message });
    }
}