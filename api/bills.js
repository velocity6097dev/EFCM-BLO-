const pool = require('./_lib/db');

let appSettingsCache = { electionMode: false, lastFetch: 0 };
let blockedCache = { bills: new Map(), vehicles: new Map(), lastFetch: 0 };

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { action } = req.query;

      // Missing-bill gaps computed entirely in SQL via generate_series
      if (action === 'integrity') {
        const { rows } = await pool.query(`
          WITH nums AS (
            SELECT bill_no::int AS n
            FROM fuel_bills
            WHERE bill_no ~ '^[0-9]+$'
          ),
          bounds AS (
            SELECT MIN(n) AS lo, MAX(n) AS hi FROM nums
          )
          SELECT s.n AS missing
          FROM bounds b, generate_series(b.lo, b.hi) AS s(n)
          WHERE b.lo IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM nums WHERE nums.n = s.n)
          ORDER BY s.n
        `);

        return res.status(200).json({ missingBills: rows.map(r => r.missing) });
      }

      // 🚀 DATE FIX: format bill_date as text in SQL (to_char) instead of
      // round-tripping through JS Date/toISOString, which shifts the date
      // back a day if bill_date is timestamptz and there's any UTC offset.
      const { rows } = await pool.query(`
        SELECT *, to_char(bill_date, 'YYYY-MM-DD') AS bill_date_str
        FROM fuel_bills
        ORDER BY id DESC
        LIMIT 1000
      `);

      return res.status(200).json(rows.map(r => ({
        id: parseInt(r.id),
        billNo: r.bill_no,
        date: r.bill_date_str || null,
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

      // Cached for 60s — avoids a round trip on every POST
      if (Date.now() - appSettingsCache.lastFetch > 60000) {
        const electionCheck = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'election_mode'");
        appSettingsCache.electionMode = electionCheck.rows.length > 0 && electionCheck.rows[0].setting_value === 'true';
        appSettingsCache.lastFetch = Date.now();
      }
      const isElectionMode = appSettingsCache.electionMode;

      // Cache blocked entities for 60s too
      if (Date.now() - blockedCache.lastFetch > 60000) {
        const blockedRes = await pool.query("SELECT block_type, block_value, reason FROM blocked_entities WHERE block_type IN ('BILL_NO', 'VEHICLE_NO')");
        const newBills = new Map();
        const newVehicles = new Map();
        for (const row of blockedRes.rows) {
          if (row.block_type === 'BILL_NO') newBills.set(row.block_value, row.reason);
          if (row.block_type === 'VEHICLE_NO') newVehicles.set(row.block_value, row.reason);
        }
        blockedCache = { bills: newBills, vehicles: newVehicles, lastFetch: Date.now() };
      }
      const blockedBills = blockedCache.bills;
      const blockedVehicles = blockedCache.vehicles;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (let b of bills) {
          const vNo = b.vehicleNo ? String(b.vehicleNo).trim() : '';
          const bNo = String(b.billNo);

          if (isElectionMode && vNo === '') {
            throw new Error(`Election Mode is ON. Vehicle No required for bill ${bNo}`);
          }

          const blockReason = blockedBills.get(bNo) || (vNo ? blockedVehicles.get(vNo) : null);
          if (blockReason) {
            if (userRole !== 'ADMIN') throw new Error(`BLOCKED: ${blockReason}. Contact Admin.`);
            else if (!b.overrideReason) {
              await client.query('ROLLBACK');
              client.release();
              return res.status(403).json({ success: false, needsOverride: true, message: `Blocked: ${blockReason}. Provide override reason.` });
            }
          }

          // 🚀 DATE FIX: cast the incoming date string explicitly to ::date
          // so it's stored as a calendar date with no time/timezone component.
          await client.query(`
            INSERT INTO fuel_bills (bill_no, bill_date, vehicle_no, fuel_type, quantity, rate, amount, is_override, override_reason) 
            VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (bill_no) DO NOTHING
          `, [
            bNo, b.date || null, vNo, b.fuelType || null,
            b.quantity || 0, b.rate || 0, b.amount || 0,
            b.overrideReason ? true : false, b.overrideReason || null
          ]);
        }

        await client.query('COMMIT');
        return res.status(201).json({ success: true });

      } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: err.message });
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error("Bills API Error:", error);
    res.status(500).json({ success: false, message: "Database connection error." });
  }
}