const pool = require('./_lib/db');

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            if (req.query.action === 'check_leftovers') {
                // Smart check: Gets count AND the oldest missed bill so the admin knows what they forgot!
                const { rows } = await pool.query(`
                    SELECT COUNT(*) as count, MIN(CAST(bill_no AS INTEGER)) as oldest_bill, to_char(MIN(bill_date), 'YYYY-MM-DD') as oldest_date 
                    FROM fuel_bills WHERE invoice_no IS NULL
                `);
                return res.status(200).json({ 
                    leftoverCount: parseInt(rows[0].count) || 0,
                    oldestBill: rows[0].oldest_bill,
                    oldestDate: rows[0].oldest_date
                });
            }

            const { rows } = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
            return res.status(200).json(rows);
        }

        else if (req.method === 'POST') {
            const { generateBy, startVal, endVal } = req.body;
            if (!startVal || !endVal) return res.status(400).json({ success: false, message: 'Start and End values are required.' });

            const invoiceNo = 'INV-' + Date.now().toString().slice(-6);
            let calcRes;

            // 🚀 DATE FIX: cast bill_date to ::date before comparing against the
            // plain YYYY-MM-DD strings from the date pickers, so a bill stored
            // with a timezone offset still matches the intended calendar date.
            if (generateBy === 'date') {
                calcRes = await pool.query('SELECT SUM(amount) as total FROM fuel_bills WHERE bill_date::date >= $1::date AND bill_date::date <= $2::date AND invoice_no IS NULL', [startVal, endVal]);
            } else { // 'bill'
                calcRes = await pool.query('SELECT SUM(amount) as total FROM fuel_bills WHERE CAST(bill_no AS INTEGER) >= $1 AND CAST(bill_no AS INTEGER) <= $2 AND invoice_no IS NULL', [parseInt(startVal), parseInt(endVal)]);
            }

            const totalAmount = parseFloat(calcRes.rows[0].total) || 0;
            if (totalAmount === 0) return res.status(400).json({ success: false, message: 'No uninvoiced bills found in this range.' });

            // 2. Create the Invoice Record
            const sDate = generateBy === 'date' ? startVal : null;
            const eDate = generateBy === 'date' ? endVal : null;
            await pool.query('INSERT INTO invoices (invoice_no, total_amount, start_date, end_date) VALUES ($1, $2, $3::date, $4::date)', [invoiceNo, totalAmount, sDate, eDate]);

            // 3. Attach bills to the new invoice
            if (generateBy === 'date') {
                await pool.query('UPDATE fuel_bills SET invoice_no = $1 WHERE bill_date::date >= $2::date AND bill_date::date <= $3::date AND invoice_no IS NULL', [invoiceNo, startVal, endVal]);
            } else {
                await pool.query('UPDATE fuel_bills SET invoice_no = $1 WHERE CAST(bill_no AS INTEGER) >= $2 AND CAST(bill_no AS INTEGER) <= $3 AND invoice_no IS NULL', [invoiceNo, parseInt(startVal), parseInt(endVal)]);
            }

            return res.status(201).json({ success: true, invoiceNo, totalAmount });
        }

        else if (req.method === 'PATCH') {
            const { invoiceNo, status, paidAmount } = req.body;
            await pool.query('UPDATE invoices SET status = $1, paid_amount = $2 WHERE invoice_no = $3', [status, paidAmount, invoiceNo]);
            return res.status(200).json({ success: true });
        }

        res.status(405).end();
    } catch (error) {
        console.error("Invoices API Error:", error);
        res.status(500).json({ error: error.message });
    }
}