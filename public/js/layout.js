// Mobile Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    sidebar.classList.toggle('open');
}

// Custom Modal System
let modalResolve = null;

window.customAlert = function(message, title = "System Notification") {
    return new Promise(resolve => { setupModal(title, message, false); modalResolve = resolve; });
};
window.customPrompt = function(message, title = "Input Required") {
    return new Promise(resolve => { setupModal(title, message, true); modalResolve = resolve; });
};

function setupModal(title, message, isPrompt) {
    document.getElementById('modalTitle').innerHTML = `<i data-lucide="bell-ring"></i> ${title}`;
    document.getElementById('modalMessage').innerText = message;
    const input = document.getElementById('modalInput');
    const cancelBtn = document.getElementById('modalBtnCancel');
    
    if (isPrompt) { input.style.display = 'block'; input.value = ''; cancelBtn.style.display = 'inline-flex'; } 
    else { input.style.display = 'none'; cancelBtn.style.display = 'none'; }
    
    const overlay = document.getElementById('customModal');
    overlay.style.display = 'flex';
    void overlay.offsetWidth; 
    overlay.classList.add('show');
    if(window.lucide) lucide.createIcons();
}

function closeModal(isConfirm) {
    const overlay = document.getElementById('customModal');
    overlay.classList.remove('show');
    setTimeout(() => overlay.style.display = 'none', 300); 
    
    if (modalResolve) {
        if (isConfirm) {
            const input = document.getElementById('modalInput');
            modalResolve(input.style.display === 'block' ? input.value : true);
        } else modalResolve(null);
        modalResolve = null;
    }
}