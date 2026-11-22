const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

function mockSessions() {
    const sessions = new Map();
    const originalQuery = pool.query;
    pool.query = function (sql, values, ...rest) {
        if (typeof sql === 'string' && sql.includes('FROM auth_sessions s JOIN users u')) {
            const user = sessions.get(values[0]);
            const rows = user && user.id === values[1] ? [user] : [];
            return Promise.resolve({ rows, rowCount: rows.length });
        }
        return originalQuery.call(pool, sql, values, ...rest);
    };
    return (id, role, username = role) => {
        const sid = randomUUID();
        sessions.set(sid, { id, role, username, company_name: null });
        return jwt.sign({ id, sid }, process.env.JWT_SECRET);
    };
}

module.exports = { mockSessions };
