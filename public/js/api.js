async function apiFetch(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json', 'x-user-role': localStorage.getItem('role') || 'USER' };
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);
    const res = await fetch(endpoint, config);
    return res.json();
}