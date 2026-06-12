async function loadSettings() {
    if(localStorage.getItem('role') !== 'ADMIN') return;
    const settings = await apiFetch('/api/settings');
    if(settings.election_mode) document.getElementById('electionMode').value = settings.election_mode;
    loadBlocks();
}

async function updateSetting(key, value) {
    await apiFetch('/api/settings', 'POST', {key, value});
    alert('Settings Updated');
}

async function blockEntity() {
    await apiFetch('/api/blocks', 'POST', {
        blockType: document.getElementById('blockType').value,
        blockValue: document.getElementById('blockValue').value,
        reason: document.getElementById('blockReason').value
    });
    document.getElementById('blockValue').value = '';
    loadBlocks();
}

async function loadBlocks() {
    const blocks = await apiFetch('/api/blocks');
    let html = '<h3>Blocked Items</h3><ul>';
    blocks.forEach(b => {
        html += `<li>${b.block_type}: <b>${b.block_value}</b> (${b.reason}) <button onclick="unblock(${b.id})">Unblock</button></li>`;
    });
    document.getElementById('blockList').innerHTML = html + '</ul>';
}

async function unblock(id) {
    await apiFetch('/api/blocks', 'DELETE', {id});
    loadBlocks();
}