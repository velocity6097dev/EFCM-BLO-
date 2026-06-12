const pool = require('./_lib/db');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT id, username, role, password_hash FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const user = result.rows[0];
        if (password === user.password_hash) {
            return res.status(200).json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error("AUTH ERROR:", error);
        res.status(500).json({ success: false, error: 'Database error', details: error.message });
    }
};