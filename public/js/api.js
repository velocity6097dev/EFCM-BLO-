async function apiFetch(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json', 'x-user-role': localStorage.getItem('role') || 'USER' };
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    const res = await fetch(endpoint, config);
    return res.json();
}

// 🚀 DATE FIX: returns YYYY-MM-DD for the user's LOCAL date/time, not UTC.
// new Date().toISOString() always returns the UTC date, which is wrong for
// timezones ahead of UTC (e.g. IST, +5:30) during the early hours of the day
// — it would return "yesterday" until ~5:30 AM local time.
function getLocalDateString(d = new Date()) {
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
}