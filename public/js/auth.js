// Check for saved username on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('rememberedUsername');
    if (savedUser && document.getElementById('username')) {
        document.getElementById('username').value = savedUser;
        document.getElementById('rememberMe').checked = true;
    }
});

// Eye Icon Toggle Logic
function togglePassword() {
    const pwdInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        // Swap to Eye-Off SVG
        eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
    } else {
        pwdInput.type = 'password';
        // Swap back to Eye SVG
        eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
    }
}

// Login Logic
async function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const remember = document.getElementById('rememberMe')?.checked;
    
    const btn = document.querySelector('.btn-login');
    btn.innerText = 'Logging in...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('role', data.user.role);
            localStorage.setItem('username', data.user.username);
            
            // Handle Remember Me feature
            if (remember) {
                localStorage.setItem('rememberedUsername', u);
            } else {
                localStorage.removeItem('rememberedUsername');
            }
            
            window.location.href = '/single.html';
        } else {
            showError(data.message || 'Invalid credentials');
        }
    } catch (err) {
        showError("Server error. Please try again.");
    } finally {
        btn.innerText = 'Log In';
        btn.disabled = false;
    }
}

function showError(msg) {
    const errBox = document.getElementById('error-msg');
    errBox.innerText = msg;
    errBox.style.display = 'block';
}

function logout() { 
    localStorage.removeItem('role'); 
    localStorage.removeItem('username'); 
    window.location.href = '/'; 
}

function checkAuth() { 
    if(!localStorage.getItem('role')) window.location.href = '/'; 
}