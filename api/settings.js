const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_ubm0XN4yKWfn@ep-plain-band-ap854c2t-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" });

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        const { rows } = await pool.query('SELECT setting_key, setting_value FROM app_settings');
        let settings = {};
        rows.forEach(r => settings[r.setting_key] = r.setting_value);
        return res.status(200).json(settings);
    } 
    else if (req.method === 'POST') {
        if (req.headers['x-user-role'] !== 'ADMIN') return res.status(403).json({error: 'Admin only'});
        const { key, value } = req.body;
        await pool.query(`INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP`, [key, value]);
        return res.status(200).json({ success: true });
    }
}