async function loadSettings() {
    if(localStorage.getItem('role') !== 'ADMIN') return;
    
    try {
        const settings = await apiFetch('/api/settings');
        if(settings.election_mode) {
            document.getElementById('electionMode').value = settings.election_mode;
        }
        loadBlocks();
    } catch (err) {
        console.error("Failed to load settings", err);
    }
}

async function updateSetting(key, value) {
    const res = await apiFetch('/api/settings', 'POST', {key, value});
    if (res.success) {
        // We use a toast-like quick alert for settings so it doesn't interrupt workflow too much
        customAlert("Settings Updated Successfully.", "System Update");
    } else {
        customAlert("Failed to update setting.", "Error");
    }
}

async function blockEntity() {
    const bType = document.getElementById('blockType').value;
    const bVal = document.getElementById('blockValue').value.trim();
    const bReason = document.getElementById('blockReason').value.trim();

    if (!bVal || !bReason) {
        return customAlert("Please provide both a Target value and a Reason.", "Missing Information");
    }

    const res = await apiFetch('/api/blocks', 'POST', {
        blockType: bType,
        blockValue: bVal,
        reason: bReason
    });

    if (res.success) {
        document.getElementById('blockValue').value = '';
        document.getElementById('blockReason').value = '';
        loadBlocks();
        customAlert(`Successfully blocked ${bType}: ${bVal}`, "Block Applied");
    } else {
        customAlert("Failed to apply block. It may already exist.", "Error");
    }
}

async function loadBlocks() {
    const listDiv = document.getElementById('blockList');
    listDiv.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Loading blocks...</div>';
    
    const blocks = await apiFetch('/api/blocks');
    
    if (blocks.length === 0) {
        listDiv.innerHTML = `
            <div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; border: 1px dashed var(--border-color);">
                <i data-lucide="shield-check" style="color: var(--success); width: 32px; height: 32px; margin-bottom: 10px;"></i>
                <div style="color: var(--text-muted);">No active blocks found.</div>
            </div>`;
        if(window.lucide) lucide.createIcons();
        return;
    }

    let html = '<div style="display: flex; flex-direction: column;">';
    blocks.forEach(b => {
        let typeIcon = b.block_type === 'VEHICLE_NO' ? 'car' : 'file-digit';
        let displayType = b.block_type === 'VEHICLE_NO' ? 'Vehicle' : 'Bill No';
        
        html += `
            <div class="block-list-item">
                <div class="block-info">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="${typeIcon}" style="color: var(--text-muted); width: 16px; height: 16px;"></i>
                        <strong>${b.block_value}</strong>
                        <span class="badge badge-danger" style="font-size: 0.65rem; padding: 2px 6px;">${displayType}</span>
                    </div>
                    <span><i data-lucide="info" style="width: 14px; height: 14px; vertical-align: -2px;"></i> ${b.reason}</span>
                </div>
                <button class="btn-outline" onclick="unblock(${b.id})" style="padding: 6px 12px; font-size: 0.85rem; color: var(--danger); border-color: var(--danger);">
                    <i data-lucide="unlock"></i> Unblock
                </button>
            </div>
        `;
    });
    html += '</div>';
    
    listDiv.innerHTML = html;
    if(window.lucide) lucide.createIcons();
}

async function unblock(id) {
    const res = await apiFetch('/api/blocks', 'DELETE', {id});
    if (res.success) {
        loadBlocks();
    } else {
        customAlert("Failed to unblock entity.", "Error");
    }
}

// ==========================================
// NEW: DAILY PRICE MANAGER LOGIC
// ==========================================

// Set default date to today for the price setter when page loads
window.addEventListener('DOMContentLoaded', () => {
    const priceDateInput = document.getElementById('priceDate');
    if(priceDateInput) {
        priceDateInput.valueAsDate = new Date();
    }
});

async function setDailyPrice() {
    const pDate = document.getElementById('priceDate').value;
    const pProduct = document.getElementById('priceProduct').value;
    const pRate = parseFloat(document.getElementById('priceRate').value);

    if (!pDate || !pProduct || isNaN(pRate)) {
        return customAlert("Please fill in Date, Product, and a valid Rate.", "Missing Data");
    }

    const res = await apiFetch('/api/prices', 'POST', {
        date: pDate, product: pProduct, rate: pRate
    });

    if (res.success) {
        customAlert(`Price for ${pProduct} on ${pDate} set to ₹${pRate.toFixed(2)}`, "Price Updated");
        document.getElementById('priceRate').value = '';
    } else {
        customAlert("Failed to save price.", "Error");
    }
}