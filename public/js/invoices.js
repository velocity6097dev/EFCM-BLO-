// ─── State ────────────────────────────────────────────────────────────────────
let currentGenerateMode = 'date';
let selectedLeftoverBills = new Set();

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initInvoices() {
    await checkLeftovers();
    await loadInvoices();
    await prefillNextInvoiceNumber();
}

// ─── Invoice Name: Auto-fill next number ─────────────────────────────────────
async function prefillNextInvoiceNumber() {
    const prefix  = (document.getElementById('invPrefix')?.value  || 'BSS').trim();
    const series  = (document.getElementById('invSeries')?.value  || '').trim();
    if (!prefix || !series) return;
    try {
        const res = await apiFetch(`/api/invoices?action=next_number&prefix=${encodeURIComponent(prefix)}&series=${encodeURIComponent(series)}`);
        if (res.nextNumber !== undefined) {
            const numEl = document.getElementById('invNumber');
            if (numEl && !numEl.dataset.userEdited) numEl.value = res.nextNumber;
        }
    } catch (_) {}
}

function onInvoiceNameInput() {
    // If user manually touches the number field, stop auto-filling
    document.getElementById('invNumber').dataset.userEdited = '1';
}

function getInvoiceName() {
    const prefix = (document.getElementById('invPrefix')?.value || '').trim();
    const series = (document.getElementById('invSeries')?.value || '').trim();
    const number = (document.getElementById('invNumber')?.value || '').trim();
    if (!prefix || !series || !number) return '';
    return `${prefix}/${series}/${number.padStart(2, '0')}`;
}

// ─── Mode Switch ──────────────────────────────────────────────────────────────
function setGenerateMode(mode) {
    currentGenerateMode = mode;
    document.getElementById('dateInputs').style.display = mode === 'date' ? 'flex' : 'none';
    document.getElementById('billInputs').style.display = mode === 'bill' ? 'flex' : 'none';
    document.getElementById('tabDate').className = mode === 'date' ? 'btn-primary' : 'btn-outline';
    document.getElementById('tabBill').className = mode === 'bill' ? 'btn-primary' : 'btn-outline';
}

// ─── Leftover Alert ───────────────────────────────────────────────────────────
async function checkLeftovers() {
    const res = await apiFetch('/api/invoices?action=check_leftovers');
    const alertBox = document.getElementById('leftoverAlert');
    if (res.leftoverCount > 0) {
        alertBox.style.display = 'flex';
        const dateStr = res.oldestDate ? new Date(res.oldestDate + 'T00:00:00').toLocaleDateString('en-IN') : 'N/A';
        alertBox.innerHTML = `
            <i data-lucide="bell-ring" style="width:24px;height:24px;flex-shrink:0"></i>
            <div style="flex:1">
                <strong>⚠️ Uninvoiced Bills:</strong> <b>${res.leftoverCount}</b> bills not attached to any invoice.<br>
                <span style="font-size:0.85rem;opacity:0.9">Oldest: <b>Bill No ${res.oldestBill}</b> dated ${dateStr}</span>
            </div>
            <button class="btn-outline" style="padding:5px 12px;font-size:0.82rem;flex-shrink:0" onclick="openLeftoverPicker()">
                <i data-lucide="list-checks"></i> Review
            </button>`;
        if (window.lucide) lucide.createIcons();
    } else {
        alertBox.style.display = 'none';
    }
}

// ─── Leftover Picker Modal ────────────────────────────────────────────────────
async function openLeftoverPicker() {
    const bills = await apiFetch('/api/invoices?action=get_leftovers');
    if (!bills || bills.length === 0) return customAlert('No leftover bills found.', 'All Clear');

    // Group by date
    const byDate = {};
    for (const b of bills) {
        const d = b.bill_date || 'Unknown';
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(b);
    }

    // Build modal HTML
    let rows = '';
    for (const [date, group] of Object.entries(byDate)) {
        const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const groupTotal  = group.reduce((s, b) => s + parseFloat(b.amount || 0), 0);
        const groupIds    = group.map(b => b.bill_no).join(',');

        rows += `
        <tr class="leftover-date-header" style="background:var(--surface-2,#f0f4f8)">
            <td colspan="5" style="padding:8px 12px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
                    <input type="checkbox" class="group-check" data-group="${groupIds}"
                        onchange="toggleGroup(this)"
                        style="width:16px;height:16px;cursor:pointer">
                    📅 ${displayDate} &nbsp;·&nbsp;
                    <span style="font-weight:400;font-size:0.88rem">${group.length} bill(s) · ₹${groupTotal.toFixed(2)}</span>
                </label>
            </td>
        </tr>`;
        for (const b of group) {
            const checked = selectedLeftoverBills.has(b.bill_no) ? 'checked' : '';
            rows += `
        <tr>
            <td style="padding:6px 12px 6px 32px">
                <input type="checkbox" class="leftover-bill-check" value="${b.bill_no}" ${checked}
                    onchange="onBillCheckChange(this)" style="width:15px;height:15px;cursor:pointer">
            </td>
            <td style="padding:6px 10px"><b>#${b.bill_no}</b></td>
            <td style="padding:6px 10px;color:var(--text-muted,#666)">${b.vehicle_no || '—'}</td>
            <td style="padding:6px 10px">${b.fuel_type || '—'}</td>
            <td style="padding:6px 10px;text-align:right">₹${parseFloat(b.amount || 0).toFixed(2)}</td>
        </tr>`;
        }
    }

    // Inject or create modal
    let modal = document.getElementById('leftoverModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'leftoverModal';
        modal.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;
            display:flex;align-items:center;justify-content:center;padding:16px`;
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div style="background:var(--surface,#fff);border-radius:12px;width:100%;max-width:680px;
                max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <!-- Header -->
        <div style="padding:18px 20px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between">
            <div>
                <div style="font-weight:700;font-size:1.05rem">📋 Leftover Bills</div>
                <div style="font-size:0.82rem;color:var(--text-muted,#666);margin-top:2px">
                    Select bills to include in the new invoice
                </div>
            </div>
            <button onclick="closeLeftoverPicker()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted,#888);padding:4px 8px">✕</button>
        </div>

        <!-- Select All Bar -->
        <div style="padding:10px 20px;border-bottom:1px solid var(--border,#e2e8f0);display:flex;align-items:center;gap:12px;background:var(--surface-2,#f8fafc)">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem;font-weight:600">
                <input type="checkbox" id="selectAllLeftovers" onchange="toggleAllLeftovers(this)"
                    style="width:16px;height:16px;cursor:pointer">
                Select All
            </label>
            <span id="leftoverSelectionSummary" style="font-size:0.85rem;color:var(--text-muted,#666)">0 selected</span>
        </div>

        <!-- Table -->
        <div style="overflow-y:auto;flex:1">
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
                <thead>
                    <tr style="background:var(--surface-2,#f0f4f8);position:sticky;top:0;z-index:1">
                        <th style="padding:8px 12px;text-align:left;width:40px"></th>
                        <th style="padding:8px 10px;text-align:left">Bill No</th>
                        <th style="padding:8px 10px;text-align:left">Vehicle</th>
                        <th style="padding:8px 10px;text-align:left">Fuel</th>
                        <th style="padding:8px 10px;text-align:right">Amount</th>
                    </tr>
                </thead>
                <tbody id="leftoverTableBody">${rows}</tbody>
            </table>
        </div>

        <!-- Footer -->
        <div style="padding:14px 20px;border-top:1px solid var(--border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;gap:12px">
            <div id="leftoverTotalBar" style="font-size:0.9rem;color:var(--text-muted,#666)">
                Selected: ₹0.00
            </div>
            <div style="display:flex;gap:10px">
                <button class="btn-outline" onclick="closeLeftoverPicker()" style="padding:8px 18px">Cancel</button>
                <button class="btn-primary" onclick="confirmLeftoverSelection()" style="padding:8px 18px">
                    ✅ Add to Invoice
                </button>
            </div>
        </div>
    </div>`;

    modal.style.display = 'flex';
    updateLeftoverSummary();
}

function closeLeftoverPicker() {
    const modal = document.getElementById('leftoverModal');
    if (modal) modal.style.display = 'none';
}

function onBillCheckChange(checkbox) {
    if (checkbox.checked) {
        selectedLeftoverBills.add(checkbox.value);
    } else {
        selectedLeftoverBills.delete(checkbox.value);
    }
    updateLeftoverSummary();
    syncGroupCheckboxes();
    syncSelectAll();
}

function toggleGroup(groupCheckbox) {
    const billNos = groupCheckbox.dataset.group.split(',');
    for (const billNo of billNos) {
        if (groupCheckbox.checked) selectedLeftoverBills.add(billNo);
        else selectedLeftoverBills.delete(billNo);
    }
    // Sync individual checkboxes
    document.querySelectorAll('.leftover-bill-check').forEach(cb => {
        if (billNos.includes(cb.value)) cb.checked = groupCheckbox.checked;
    });
    updateLeftoverSummary();
    syncSelectAll();
}

function toggleAllLeftovers(masterCb) {
    document.querySelectorAll('.leftover-bill-check').forEach(cb => {
        cb.checked = masterCb.checked;
        if (masterCb.checked) selectedLeftoverBills.add(cb.value);
        else selectedLeftoverBills.delete(cb.value);
    });
    document.querySelectorAll('.group-check').forEach(cb => cb.checked = masterCb.checked);
    updateLeftoverSummary();
}

function syncGroupCheckboxes() {
    document.querySelectorAll('.group-check').forEach(groupCb => {
        const billNos = groupCb.dataset.group.split(',');
        const allChecked = billNos.every(no => selectedLeftoverBills.has(no));
        groupCb.checked = allChecked;
    });
}

function syncSelectAll() {
    const all   = document.querySelectorAll('.leftover-bill-check');
    const checked = [...all].filter(c => c.checked);
    const masterCb = document.getElementById('selectAllLeftovers');
    if (masterCb) masterCb.checked = all.length > 0 && checked.length === all.length;
}

function updateLeftoverSummary() {
    // Total from checked rows
    let total = 0;
    document.querySelectorAll('.leftover-bill-check:checked').forEach(cb => {
        const row = cb.closest('tr');
        const amtCell = row?.querySelector('td:last-child');
        if (amtCell) {
            const amt = parseFloat(amtCell.textContent.replace('₹', '')) || 0;
            total += amt;
        }
    });
    const count = selectedLeftoverBills.size;
    const summaryEl = document.getElementById('leftoverSelectionSummary');
    const totalEl   = document.getElementById('leftoverTotalBar');
    if (summaryEl) summaryEl.textContent = `${count} selected`;
    if (totalEl)   totalEl.textContent   = `Selected: ₹${total.toFixed(2)}`;
}

function confirmLeftoverSelection() {
    closeLeftoverPicker();
    const count = selectedLeftoverBills.size;
    if (count > 0) {
        const badge = document.getElementById('leftoverBadge');
        if (badge) {
            badge.style.display = 'inline-flex';
            badge.textContent = `+${count} leftover bill(s) included`;
        }
    }
}

// ─── Load Invoice Table ───────────────────────────────────────────────────────
async function loadInvoices() {
    const invoices = await apiFetch('/api/invoices');
    const tbody = document.getElementById('invoiceTableBody');
    tbody.innerHTML = '';

    if (!invoices || invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted,#888)">No invoices yet.</td></tr>`;
        return;
    }

    invoices.forEach(inv => {
        const badgeClass = inv.status === 'PAID' ? 'badge-success' : (inv.status === 'PARTIAL' ? 'badge-warning' : 'badge-danger');
        const sDate = inv.start_date ? new Date(inv.start_date + 'T00:00:00').toLocaleDateString('en-IN') : '—';
        const eDate = inv.end_date   ? new Date(inv.end_date   + 'T00:00:00').toLocaleDateString('en-IN') : '—';
        tbody.innerHTML += `
            <tr>
                <td><strong>${inv.invoice_no}</strong></td>
                <td style="font-size:0.88rem">${sDate} → ${eDate}</td>
                <td>₹${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td>₹${parseFloat(inv.paid_amount || 0).toFixed(2)}</td>
                <td><span class="badge ${badgeClass}">${inv.status}</span></td>
                <td>
                    <button class="btn-outline" style="padding:6px 12px;font-size:0.85rem"
                        onclick="editInvoice('${inv.invoice_no}', ${inv.paid_amount || 0}, ${inv.total_amount})">
                        <i data-lucide="wallet"></i> Collect
                    </button>
                </td>
            </tr>`;
    });
    if (window.lucide) lucide.createIcons();
}

// ─── Generate Invoice ─────────────────────────────────────────────────────────
async function generateInvoice() {
    let startVal, endVal;
    if (currentGenerateMode === 'date') {
        startVal = document.getElementById('invStartDate').value;
        endVal   = document.getElementById('invEndDate').value;
    } else {
        startVal = document.getElementById('invStartBill').value;
        endVal   = document.getElementById('invEndBill').value;
    }

    const invoiceName = getInvoiceName();
    if (!invoiceName) return customAlert('Please fill in Prefix, Series, and Number for the invoice name.', 'Missing Invoice Name');
    if (!startVal || !endVal) return customAlert('Please fill in both start and end fields.', 'Missing Range');

    const btn = document.getElementById('generateBtn');
    btn.innerHTML = `<i data-lucide="loader"></i> Generating...`;
    if (window.lucide) lucide.createIcons();

    const payload = {
        generateBy: currentGenerateMode,
        startVal,
        endVal,
        invoiceName,
        leftoverBillNos: [...selectedLeftoverBills]
    };

    const res = await apiFetch('/api/invoices', 'POST', payload);

    if (res.success) {
        selectedLeftoverBills.clear();
        const badge = document.getElementById('leftoverBadge');
        if (badge) badge.style.display = 'none';

        // Auto-increment the number for next invoice
        const numEl = document.getElementById('invNumber');
        if (numEl) {
            const next = (parseInt(numEl.value) || 0) + 1;
            numEl.value = String(next).padStart(2, '0');
            delete numEl.dataset.userEdited;
        }

        await customAlert(
            `Invoice <b>${res.invoiceNo}</b> created successfully!\n${res.billCount} bill(s) · ₹${parseFloat(res.totalAmount).toFixed(2)}`,
            'Invoice Generated ✅'
        );
        initInvoices();
    } else {
        customAlert(res.message || 'Failed to generate invoice.', 'Error');
    }

    btn.innerHTML = `<i data-lucide="file-check-2"></i> Generate Invoice`;
    if (window.lucide) lucide.createIcons();
}

// ─── Collect Payment ──────────────────────────────────────────────────────────
async function editInvoice(invoiceNo, currentPaid, totalAmount) {
    const newPaidStr = await customPrompt(
        `Total: ₹${totalAmount}\nCollected so far: ₹${currentPaid}\n\nEnter NEW TOTAL amount collected:`,
        `Update ${invoiceNo}`
    );
    if (newPaidStr === null || newPaidStr === '') return;

    const newPaid = parseFloat(newPaidStr) || 0;
    let newStatus = 'PENDING';
    if (newPaid >= totalAmount) newStatus = 'PAID';
    else if (newPaid > 0) newStatus = 'PARTIAL';

    const res = await apiFetch('/api/invoices', 'PATCH', { invoiceNo, status: newStatus, paidAmount: newPaid });
    if (res.success) initInvoices();
    else customAlert('Failed to update invoice.', 'Error');
}