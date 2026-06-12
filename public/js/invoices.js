let currentGenerateMode = 'date'; // 'date' or 'bill'

async function initInvoices() {
    await checkLeftovers();
    await loadInvoices();
}

function setGenerateMode(mode) {
    currentGenerateMode = mode;
    document.getElementById('dateInputs').style.display = mode === 'date' ? 'flex' : 'none';
    document.getElementById('billInputs').style.display = mode === 'bill' ? 'flex' : 'none';
    
    // UI Tab styling
    document.getElementById('tabDate').className = mode === 'date' ? 'btn-primary' : 'btn-outline';
    document.getElementById('tabBill').className = mode === 'bill' ? 'btn-primary' : 'btn-outline';
}

async function checkLeftovers() {
    const res = await apiFetch('/api/invoices?action=check_leftovers');
    const alertBox = document.getElementById('leftoverAlert');
    
    if (res.leftoverCount > 0) {
        alertBox.style.display = 'flex';
        let dateStr = res.oldestDate ? new Date(res.oldestDate).toLocaleDateString() : 'N/A';
        alertBox.innerHTML = `
            <i data-lucide="bell-ring" style="width: 24px; height: 24px;"></i> 
            <div>
                <strong>⚠️ Missing Bills Warning:</strong> You have <b>${res.leftoverCount}</b> bills not attached to any invoice. <br>
                <span style="font-size: 0.85rem; opacity: 0.9;">The oldest missed bill is <b>Bill No ${res.oldestBill}</b> from ${dateStr}.</span>
            </div>`;
        if(window.lucide) lucide.createIcons();
    } else {
        alertBox.style.display = 'none';
    }
}

async function loadInvoices() {
    const invoices = await apiFetch('/api/invoices');
    const tbody = document.getElementById('invoiceTableBody');
    tbody.innerHTML = '';
    
    invoices.forEach(inv => {
        let badgeClass = inv.status === 'PAID' ? 'badge-success' : (inv.status === 'PARTIAL' ? 'badge-warning' : 'badge-danger');
        let sDate = inv.start_date ? new Date(inv.start_date).toLocaleDateString() : 'Multi-Date';
        let eDate = inv.end_date ? new Date(inv.end_date).toLocaleDateString() : '(By Bill No)';

        tbody.innerHTML += `
            <tr>
                <td><strong>${inv.invoice_no}</strong></td>
                <td>${sDate} to ${eDate}</td>
                <td>₹${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td>₹${parseFloat(inv.paid_amount).toFixed(2)}</td>
                <td><span class="badge ${badgeClass}">${inv.status}</span></td>
                <td>
                    <button class="btn-outline" style="padding: 6px 12px; font-size: 0.85rem;" onclick="editInvoice('${inv.invoice_no}', ${inv.paid_amount}, ${inv.total_amount})">
                        <i data-lucide="wallet"></i> Collect
                    </button>
                </td>
            </tr>
        `;
    });
    if(window.lucide) lucide.createIcons();
}

async function generateInvoice() {
    let startVal, endVal;
    
    if (currentGenerateMode === 'date') {
        startVal = document.getElementById('invStartDate').value;
        endVal = document.getElementById('invEndDate').value;
    } else {
        startVal = document.getElementById('invStartBill').value;
        endVal = document.getElementById('invEndBill').value;
    }
    
    if (!startVal || !endVal) return customAlert("Please fill in both start and end fields.", "Missing Data");
    
    const btn = document.getElementById('generateBtn');
    btn.innerHTML = `<i data-lucide="loader"></i> Generating...`;
    
    const res = await apiFetch('/api/invoices', 'POST', { generateBy: currentGenerateMode, startVal, endVal });
    
    if (res.success) {
        await customAlert(`Successfully generated Invoice ${res.invoiceNo} for ₹${res.totalAmount}`, "Success!");
        initInvoices(); // Refresh the list
    } else {
        customAlert(res.message, "Failed");
    }
    btn.innerHTML = `<i data-lucide="file-check-2"></i> Generate Invoice`;
    if(window.lucide) lucide.createIcons();
}

async function editInvoice(invoiceNo, currentPaid, totalAmount) {
    const newPaidStr = await customPrompt(`Total Bill Amount: ₹${totalAmount}\nCurrently Collected: ₹${currentPaid}\n\nEnter the NEW TOTAL amount collected:`, `Update ${invoiceNo}`);
    
    if (!newPaidStr) return; // Cancelled
    
    const newPaid = parseFloat(newPaidStr) || 0;
    
    let newStatus = 'PENDING';
    if (newPaid >= totalAmount) newStatus = 'PAID';
    else if (newPaid > 0) newStatus = 'PARTIAL';

    const res = await apiFetch('/api/invoices', 'PATCH', { invoiceNo, status: newStatus, paidAmount: newPaid });
    
    if (res.success) {
        initInvoices(); 
    } else {
        customAlert("Failed to update invoice.", "Error");
    }
}