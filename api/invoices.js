const pool = require('./_lib/db');

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {

            // --- Check leftover uninvoiced bills ---
            if (req.query.action === 'check_leftovers') {
                const { rows } = await pool.query(`
                    SELECT 
                        COUNT(*) as count,
                        MIN(CAST(bill_no AS INTEGER)) as oldest_bill,
                        to_char(MIN(bill_date), 'YYYY-MM-DD') as oldest_date,
                        to_char(MAX(bill_date), 'YYYY-MM-DD') as newest_date
                    FROM fuel_bills WHERE invoice_no IS NULL
                `);
                return res.status(200).json({
                    leftoverCount: parseInt(rows[0].count) || 0,
                    oldestBill: rows[0].oldest_bill,
                    oldestDate: rows[0].oldest_date,
                    newestDate: rows[0].newest_date
                });
            }

            // --- Fetch leftover bills grouped by date range for the picker modal ---
            if (req.query.action === 'get_leftovers') {
                const { rows } = await pool.query(`
                    SELECT 
                        bill_no,
                        to_char(bill_date, 'YYYY-MM-DD') as bill_date,
                        vehicle_no,
                        fuel_type,
                        amount
                    FROM fuel_bills
                    WHERE invoice_no IS NULL
                    ORDER BY bill_date ASC, CAST(bill_no AS INTEGER) ASC
                `);
                return res.status(200).json(rows);
            }

            // --- Get next invoice number for a given prefix/series ---
            if (req.query.action === 'next_number') {
                const { prefix, series } = req.query;
                if (!prefix || !series) return res.status(400).json({ success: false, message: 'prefix and series required' });

                const likePattern = `${prefix}/${series}/%`;
                const { rows } = await pool.query(`
                    SELECT invoice_no FROM invoices
                    WHERE invoice_no LIKE $1
                    ORDER BY id DESC LIMIT 1
                `, [likePattern]);

                let nextNum = 1;
                if (rows.length > 0) {
                    const parts = rows[0].invoice_no.split('/');
                    const lastNum = parseInt(parts[parts.length - 1]);
                    if (!isNaN(lastNum)) nextNum = lastNum + 1;
                }
                return res.status(200).json({ nextNumber: String(nextNum).padStart(2, '0') });
            }

            // --- Fetch all invoices ---
            const { rows } = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
            return res.status(200).json(rows);
        }

        // --- Generate Invoice (POST) ---
        else if (req.method === 'POST') {
            const { generateBy, startVal, endVal, invoiceName, leftoverBillNos } = req.body;

            if (!invoiceName || !invoiceName.trim()) {
                return res.status(400).json({ success: false, message: 'Invoice name is required.' });
            }
            if (!startVal || !endVal) {
                return res.status(400).json({ success: false, message: 'Start and End values are required.' });
            }

            const invoiceNo = invoiceName.trim();

            // Check duplicate name
            const dupCheck = await pool.query('SELECT id FROM invoices WHERE invoice_no = $1', [invoiceNo]);
            if (dupCheck.rows.length > 0) {
                return res.status(400).json({ success: false, message: `Invoice "${invoiceNo}" already exists.` });
            }

            // Build the bill_nos list: primary range + any selected leftovers
            let primaryBillNos = [];

            if (generateBy === 'date') {
                const { rows } = await pool.query(`
                    SELECT bill_no FROM fuel_bills
                    WHERE bill_date::date >= $1::date AND bill_date::date <= $2::date AND invoice_no IS NULL
                `, [startVal, endVal]);
                primaryBillNos = rows.map(r => r.bill_no);
            } else {
                const { rows } = await pool.query(`
                    SELECT bill_no FROM fuel_bills
                    WHERE CAST(bill_no AS INTEGER) >= $1 AND CAST(bill_no AS INTEGER) <= $2 AND invoice_no IS NULL
                `, [parseInt(startVal), parseInt(endVal)]);
                primaryBillNos = rows.map(r => r.bill_no);
            }

            // Merge selected leftover bill numbers (user-chosen, no duplicates)
            const extraBillNos = Array.isArray(leftoverBillNos) ? leftoverBillNos : [];
            const allBillNos = [...new Set([...primaryBillNos, ...extraBillNos])];

            if (allBillNos.length === 0) {
                return res.status(400).json({ success: false, message: 'No uninvoiced bills found in this range.' });
            }

            // Calculate total
            const calcRes = await pool.query(`
                SELECT SUM(amount) as total FROM fuel_bills
                WHERE bill_no = ANY($1) AND invoice_no IS NULL
            `, [allBillNos]);

            const totalAmount = parseFloat(calcRes.rows[0].total) || 0;
            if (totalAmount === 0) {
                return res.status(400).json({ success: false, message: 'No uninvoiced bills found in this range.' });
            }

            // Date bounds for the invoice record
            const boundsRes = await pool.query(`
                SELECT 
                    to_char(MIN(bill_date), 'YYYY-MM-DD') as min_date,
                    to_char(MAX(bill_date), 'YYYY-MM-DD') as max_date
                FROM fuel_bills WHERE bill_no = ANY($1)
            `, [allBillNos]);

            const sDate = boundsRes.rows[0].min_date || null;
            const eDate = boundsRes.rows[0].max_date || null;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                await client.query(`
                    INSERT INTO invoices (invoice_no, total_amount, start_date, end_date)
                    VALUES ($1, $2, $3::date, $4::date)
                `, [invoiceNo, totalAmount, sDate, eDate]);

                await client.query(`
                    UPDATE fuel_bills SET invoice_no = $1
                    WHERE bill_no = ANY($2) AND invoice_no IS NULL
                `, [invoiceNo, allBillNos]);

                await client.query('COMMIT');
                return res.status(201).json({
                    success: true,
                    invoiceNo,
                    totalAmount,
                    billCount: allBillNos.length
                });
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }

        // --- Update Invoice payment (PATCH) ---
        else if (req.method === 'PATCH') {
            const { invoiceNo, status, paidAmount } = req.body;
            await pool.query(
                'UPDATE invoices SET status = $1, paid_amount = $2 WHERE invoice_no = $3',
                [status, paidAmount, invoiceNo]
            );
            return res.status(200).json({ success: true });
        }

        res.status(405).end();
    } catch (error) {
        console.error("Invoices API Error:", error);
        res.status(500).json({ error: error.message });
    }
}