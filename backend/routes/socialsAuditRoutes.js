const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/public-reviews', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, source_platform, client_name, company_or_line, division, rating, review_text, admin_reply, created_at
             FROM client_reputation_reviews
             WHERE featured_on_home = TRUE
             ORDER BY created_at DESC LIMIT 12`
        );
        res.json({ reviews: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load public reviews.' });
    }
});

router.use(verifyToken);

// SOCIALS & REPUTATION MANAGEMENT
router.get('/socials', async (req, res) => {
    try {
        const [postsRes, reviewsRes] = await Promise.all([
            pool.query(`SELECT * FROM social_posts_campaigns ORDER BY created_at DESC`),
            pool.query(`SELECT * FROM client_reputation_reviews ORDER BY created_at DESC`)
        ]);
        res.json({ posts: postsRes.rows, reviews: reviewsRes.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load socials hub.' });
    }
});

router.post('/socials/posts', requireRole('Admin', 'FleetManager', 'Dispatcher'), async (req, res) => {
    try {
        const { platform, division = 'ALL', language = 'EN', headline, body_copy, cta_link = '/track', status = 'Published' } = req.body;
        const created = await pool.query(
            `INSERT INTO social_posts_campaigns
             (platform, division, language, headline, body_copy, cta_link, status, published_at, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 = 'Published' THEN CURRENT_TIMESTAMP ELSE NULL END, $8)
             RETURNING *`,
            [platform, division, language, headline, body_copy, cta_link, status, req.user.id]
        );
        res.status(201).json({ message: 'Social campaign saved.', post: created.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save social post.' });
    }
});

router.post('/socials/reviews', requireRole('Admin', 'FleetManager'), async (req, res) => {
    try {
        const { source_platform = 'Google Business', client_name, company_or_line = '', division = 'CONTAINER_DEPOT', rating = 5, review_text, admin_reply = '' } = req.body;
        const created = await pool.query(
            `INSERT INTO client_reputation_reviews
             (source_platform, client_name, company_or_line, division, rating, review_text, admin_reply)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING *`,
            [source_platform, client_name, company_or_line, division, Number(rating), review_text, admin_reply]
        );
        res.status(201).json({ message: 'Client review logged.', review: created.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to log client review.' });
    }
});

// FORENSIC ANTI-THEFT & MANAGEMENT AUDIT PACK (Spares + Fuel + Mileage + Petty Cash + Bank + Mechanics)
router.get('/forensic-audit', requireRole('Admin', 'FleetManager'), async (req, res) => {
    try {
        const dateFrom = req.query.date_from || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        const dateTo = req.query.date_to || new Date().toISOString().slice(0, 10);

        const [
            sparesReconciliation,
            fuelAnomalies,
            mileageSummary,
            pettyCashAudit,
            bankUnreconciled,
            mechanicAudit
        ] = await Promise.all([
            // 1. 3-Way Spares Audit: Bought vs Issued vs Closing Stock vs Unreturned Cores
            pool.query(
                `SELECT ii.id, ii.sku, ii.item_name, ii.category, ii.unit_cost, ii.quantity_on_hand, ii.requires_old_core,
                        COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_type = 'STOCK_IN' AND im.created_at::date BETWEEN $1::date AND $2::date), 0) AS qty_bought,
                        COALESCE(SUM(im.quantity) FILTER (WHERE im.movement_type = 'ISSUE' AND im.created_at::date BETWEEN $1::date AND $2::date), 0) AS qty_issued,
                        COUNT(im.id) FILTER (WHERE ii.requires_old_core = TRUE AND im.movement_type = 'ISSUE' AND im.old_core_returned = FALSE)::int AS missing_cores
                 FROM inventory_items ii
                 LEFT JOIN inventory_movements im ON im.item_id = ii.id
                 GROUP BY ii.id
                 ORDER BY missing_cores DESC, ii.item_name ASC`,
                [dateFrom, dateTo]
            ),
            // 2. Fuel vs Trips vs eTIMS & km/L Audit
            pool.query(
                `SELECT f.*, t.plate_number, tr.tracking_code
                 FROM fuel_reconciliations f
                 LEFT JOIN trucks t ON f.truck_id = t.id
                 LEFT JOIN trips tr ON f.trip_id = tr.id
                 WHERE f.fuel_date BETWEEN $1::date AND $2::date
                 ORDER BY CASE WHEN f.audit_status = 'Flagged' THEN 0 ELSE 1 END, f.fuel_date DESC`,
                [dateFrom, dateTo]
            ),
            // 3. Mass Mileage & Zero-KM Yard Idle Audit
            pool.query(
                `SELECT t.plate_number,
                        COUNT(m.id)::int AS days_logged,
                        COALESCE(SUM(m.distance_km), 0)::numeric(12,1) AS total_km,
                        COUNT(m.id) FILTER (WHERE m.distance_km = 0)::int AS zero_km_days
                 FROM trucks t
                 LEFT JOIN daily_fleet_mileage m ON m.truck_id = t.id AND m.log_date BETWEEN $1::date AND $2::date
                 GROUP BY t.id, t.plate_number
                 ORDER BY total_km DESC`,
                [dateFrom, dateTo]
            ),
            // 4. Petty Cash Requested vs Spent vs eTIMS CU Invoice
            pool.query(
                `SELECT v.*, u.name AS requester_name
                 FROM petty_cash_vouchers v
                 JOIN users u ON v.requested_by = u.id
                 WHERE v.created_at::date BETWEEN $1::date AND $2::date
                 ORDER BY CASE WHEN v.receipt_verified = FALSE THEN 0 ELSE 1 END, v.created_at DESC`,
                [dateFrom, dateTo]
            ),
            // 5. Bank Statement Entries & Unreconciled Items
            pool.query(
                `SELECT *
                 FROM bank_ledger_entries
                 WHERE entry_date BETWEEN $1::date AND $2::date
                 ORDER BY reconciled ASC, entry_date DESC`,
                [dateFrom, dateTo]
            ),
            // 6. Mechanic Response Lag & Completion Audit
            pool.query(
                `SELECT u.name AS mechanic_name,
                        COUNT(wo.id)::int AS jobs_assigned,
                        COUNT(wo.id) FILTER (WHERE wo.status IN ('Completed', 'Released'))::int AS jobs_completed,
                        COALESCE(AVG(wo.idle_minutes), 0)::int AS avg_start_delay_mins,
                        COALESCE(SUM(wo.total_estimate), 0)::numeric(12,2) AS billed_work_value
                 FROM users u
                 LEFT JOIN garage_work_orders wo ON wo.assigned_mechanic_id = u.id AND wo.created_at::date BETWEEN $1::date AND $2::date
                 WHERE u.role = 'Mechanic'
                 GROUP BY u.id, u.name
                 ORDER BY avg_start_delay_mins DESC`,
                [dateFrom, dateTo]
            )
        ]);

        res.json({
            period: { date_from: dateFrom, date_to: dateTo },
            spares: sparesReconciliation.rows,
            fuel: fuelAnomalies.rows,
            mileage: mileageSummary.rows,
            petty_cash: pettyCashAudit.rows,
            bank: bankUnreconciled.rows,
            mechanics: mechanicAudit.rows
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate forensic audit report.' });
    }
});

module.exports = router;