async function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (data.success) {
        localStorage.setItem('role', data.user.role);
        localStorage.setItem('username', data.user.username);
        window.location.href = '/dashboard';
    } else {
        document.getElementById('error-msg').innerText = data.message;
        document.getElementById('error-msg').style.display = 'block';
    }
}
function logout() { localStorage.clear(); window.location.href = '/'; }
function checkAuth() { if(!localStorage.getItem('role')) window.location.href = '/'; }