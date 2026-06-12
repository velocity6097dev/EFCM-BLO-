const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_ubm0XN4yKWfn@ep-plain-band-ap854c2t-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" });

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { action } = req.query;
      if (action === 'integrity') {
          const result = await pool.query(`
              WITH seq AS (SELECT generate_series((SELECT MIN(CAST(bill_no AS INTEGER)) FROM fuel_bills), (SELECT MAX(CAST(bill_no AS INTEGER)) FROM fuel_bills)) AS expected_bill)
              SELECT expected_bill FROM seq LEFT JOIN fuel_bills fb ON seq.expected_bill = CAST(fb.bill_no AS INTEGER) WHERE fb.bill_no IS NULL;
          `);
          return res.status(200).json({ missingBills: result.rows.map(r => r.expected_bill) });
      }

      const { rows } = await pool.query('SELECT * FROM fuel_bills ORDER BY CAST(bill_no AS INTEGER) DESC LIMIT 1000');
      return res.status(200).json(rows.map(r => ({
        id: parseInt(r.id), billNo: r.bill_no, date: r.bill_date ? r.bill_date.toISOString().split('T')[0] : null,
        vehicleNo: r.vehicle_no, fuelType: r.fuel_type, qnty: parseFloat(r.amount), rate: 0, amount: parseFloat(r.amount), isOverride: r.is_override
      })));
    } 
    else if (req.method === 'POST') {
      let bills = Array.isArray(req.body) ? req.body : [req.body];
      const userRole = req.headers['x-user-role'] || 'USER';

      const electionCheck = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'election_mode'");
      const isElectionMode = electionCheck.rows.length > 0 && electionCheck.rows[0].setting_value === 'true';

      for (let b of bills) {
          if (isElectionMode && (!b.vehicleNo || b.vehicleNo.trim() === '')) return res.status(400).json({ success: false, message: `Election Mode is ON. Vehicle No required for bill ${b.billNo}` });

          const blockCheck = await pool.query(`SELECT * FROM blocked_entities WHERE (block_type = 'BILL_NO' AND block_value = $1) OR (block_type = 'VEHICLE_NO' AND block_value = $2)`, [b.billNo.toString(), b.vehicleNo]);
          if (blockCheck.rows.length > 0) {
              if (userRole !== 'ADMIN') return res.status(403).json({ success: false, message: `BLOCKED: ${blockCheck.rows[0].reason}. Contact Admin.` });
              else if (!b.overrideReason) return res.status(403).json({ success: false, needsOverride: true, message: `Blocked: ${blockCheck.rows[0].reason}. Provide override reason.` });
          }

          await pool.query(`
            INSERT INTO fuel_bills (bill_no, bill_date, vehicle_no, fuel_type, amount, is_override, override_reason) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING
          `, [b.billNo, b.date, b.vehicleNo, b.fuelType, b.amount, b.overrideReason ? true : false, b.overrideReason || null]);
      }
      return res.status(201).json({ success: true });
    }
  } catch (error) { res.status(500).json({ error: error.message }); }
}