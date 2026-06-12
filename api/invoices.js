const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://neondb_owner:npg_WeBqunU56xPX@ep-lucky-cloud-aozli1uh.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" });

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // Check if there are old bills lying around without an invoice
            if (req.query.action === 'check_leftovers') {
                const { rows } = await pool.query('SELECT COUNT(*) as count FROM fuel_bills WHERE invoice_no IS NULL');
                return res.status(200).json({ leftoverCount: parseInt(rows[0].count) });
            }
            
            // Standard fetch for all invoices
            const { rows } = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
            return res.status(200).json(rows);
        }
        
        else if (req.method === 'POST') {
            // Generate a brand new invoice based on a date range
            const { startDate, endDate } = req.body;
            if (!startDate || !endDate) return res.status(400).json({ success: false, message: 'Dates required' });

            const invoiceNo = 'INV-' + Date.now().toString().slice(-6); // e.g. INV-123456

            // Calculate total for UNINVOICED bills in this date range
            const calcRes = await pool.query(`
                SELECT SUM(amount) as total FROM fuel_bills 
                WHERE bill_date >= $1 AND bill_date <= $2 AND invoice_no IS NULL
            `, [startDate, endDate]);

            const totalAmount = parseFloat(calcRes.rows[0].total) || 0;
            if (totalAmount === 0) return res.status(400).json({ success: false, message: 'No leftover bills found in this date range.' });

            // 1. Create the Invoice Record
            await pool.query(`
                INSERT INTO invoices (invoice_no, total_amount, start_date, end_date) 
                VALUES ($1, $2, $3, $4)
            `, [invoiceNo, totalAmount, startDate, endDate]);

            // 2. Attach those bills to the new invoice
            await pool.query(`
                UPDATE fuel_bills SET invoice_no = $1 
                WHERE bill_date >= $2 AND bill_date <= $3 AND invoice_no IS NULL
            `, [invoiceNo, startDate, endDate]);

            return res.status(201).json({ success: true, invoiceNo, totalAmount });
        }
        
        else if (req.method === 'PATCH') {
            // Admin updating the payment status (Pending -> Partial -> Paid)
            const { invoiceNo, status, paidAmount } = req.body;
            await pool.query(`
                UPDATE invoices SET status = $1, paid_amount = $2 WHERE invoice_no = $3
            `, [status, paidAmount, invoiceNo]);
            return res.status(200).json({ success: true });
        }
        
        res.status(405).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}