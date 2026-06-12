const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_ubm0XN4yKWfn@ep-plain-band-ap854c2t-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require" });

module.exports = async function handler(req, res) {
  try {
    // --- ADVANCED AUTO-MIGRATION ---
    try {
        await pool.query('ALTER TABLE fuel_bills ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(50)');
        await pool.query('ALTER TABLE fuel_bills ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0');
        await pool.query('ALTER TABLE fuel_bills ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 0');
        await pool.query('ALTER TABLE fuel_bills ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT FALSE');
        await pool.query('ALTER TABLE fuel_bills ADD COLUMN IF NOT EXISTS override_reason TEXT');
    } catch(err) { 
        console.log("Migration check skipped."); 
    }

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
        id: parseInt(r.id), 
        billNo: r.bill_no, 
        date: r.bill_date ? new Date(r.bill_date).toISOString().split('T')[0] : null,
        vehicleNo: r.vehicle_no || '', 
        fuelType: r.fuel_type, 
        quantity: parseFloat(r.quantity || 0), 
        rate: parseFloat(r.rate || 0),         
        amount: parseFloat(r.amount || 0), 
        isOverride: r.is_override
      })));
    } 
    else if (req.method === 'POST') {
      let bills = Array.isArray(req.body) ? req.body : [req.body];
      const userRole = req.headers['x-user-role'] || 'USER';

      let isElectionMode = false;
      try {
          const electionCheck = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'election_mode'");
          isElectionMode = electionCheck.rows.length > 0 && electionCheck.rows[0].setting_value === 'true';
      } catch(e) {}

      for (let b of bills) {
          const vNo = b.vehicleNo ? String(b.vehicleNo).trim() : '';
          const bNo = String(b.billNo);

          if (isElectionMode && vNo === '') {
              return res.status(400).json({ success: false, message: `Election Mode is ON. Vehicle No required for bill ${bNo}` });
          }

          try {
              const blockCheck = await pool.query(
                  `SELECT * FROM blocked_entities WHERE (block_type = 'BILL_NO' AND block_value = $1) OR (block_type = 'VEHICLE_NO' AND block_value = $2 AND $2 != '')`, 
                  [bNo, vNo]
              );
              
              if (blockCheck.rows.length > 0) {
                  if (userRole !== 'ADMIN') return res.status(403).json({ success: false, message: `BLOCKED: ${blockCheck.rows[0].reason}. Contact Admin.` });
                  else if (!b.overrideReason) return res.status(403).json({ success: false, needsOverride: true, message: `Blocked: ${blockCheck.rows[0].reason}. Provide override reason.` });
              }
          } catch(e) {}

          // --- FIXED DUPLICATE LOGIC ---
          // Instead of ON CONFLICT, we manually check if the bill exists to bypass constraint requirements
          const duplicateCheck = await pool.query('SELECT bill_no FROM fuel_bills WHERE bill_no = $1', [bNo]);
          if (duplicateCheck.rows.length > 0) {
              continue; // Skip this bill entirely, it already exists (Mimics DO NOTHING)
          }

          try {
              await pool.query(`
                INSERT INTO fuel_bills (bill_no, bill_date, vehicle_no, fuel_type, quantity, rate, amount, is_override, override_reason) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              `, [
                  bNo, b.date || null, vNo, b.fuelType || null, 
                  b.quantity || 0, b.rate || 0, b.amount || 0, 
                  b.overrideReason ? true : false, b.overrideReason || null
              ]);
          } catch (insertErr) {
              if (insertErr.message.includes('does not exist') || insertErr.message.includes('quantity')) {
                  // Fallback for older database schema
                  await pool.query(`
                    INSERT INTO fuel_bills (bill_no, bill_date, vehicle_no, fuel_type, amount, is_override, override_reason) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                  `, [
                      bNo, b.date || null, vNo, b.fuelType || null, b.amount || 0, 
                      b.overrideReason ? true : false, b.overrideReason || null
                  ]);
              } else {
                  throw insertErr; 
              }
          }
      }
      return res.status(201).json({ success: true });
    }
  } catch (error) { 
      console.error("Bills API Error:", error);
      res.status(500).json({ success: false, message: error.message || "Database connection error." }); 
  }
}