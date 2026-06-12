async function initInvoices() {
    await checkLeftovers();
    await loadInvoices();
}

async function checkLeftovers() {
    const res = await apiFetch('/api/invoices?action=check_leftovers');
    const alertBox = document.getElementById('leftoverAlert');
    if (res.leftoverCount > 0) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = `<strong>⚠️ Leftover Warning:</strong> You have <b>${res.leftoverCount}</b> older bills not attached to any invoice. Please generate an invoice to clear them.`;
        alertBox.style.padding = "10px";
        alertBox.style.backgroundColor = "#fff1f2";
        alertBox.style.color = "#be123c";
        alertBox.style.border = "1px solid #fecdd3";
        alertBox.style.borderRadius = "6px";
        alertBox.style.marginBottom = "15px";
    } else {
        alertBox.style.display = 'none';
    }
}

async function loadInvoices() {
    const invoices = await apiFetch('/api/invoices');
    const tbody = document.getElementById('invoiceTableBody');
    tbody.innerHTML = '';
    
    invoices.forEach(inv => {
        let statusColor = inv.status === 'PAID' ? '#10b981' : (inv.status === 'PARTIAL' ? '#f59e0b' : '#ef4444');
        
        // Format dates cleanly
        let sDate = inv.start_date ? new Date(inv.start_date).toLocaleDateString() : 'N/A';
        let eDate = inv.end_date ? new Date(inv.end_date).toLocaleDateString() : 'N/A';

        tbody.innerHTML += `
            <tr>
                <td><strong>${inv.invoice_no}</strong></td>
                <td>${sDate} to ${eDate}</td>
                <td>₹${parseFloat(inv.total_amount).toFixed(2)}</td>
                <td>₹${parseFloat(inv.paid_amount).toFixed(2)}</td>
                <td><span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem;">${inv.status}</span></td>
                <td>
                    <button class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="editInvoice('${inv.invoice_no}', ${inv.paid_amount}, ${inv.total_amount})">✏️ Update Payment</button>
                </td>
            </tr>
        `;
    });
}

async function generateInvoice() {
    const startDate = document.getElementById('invStartDate').value;
    const endDate = document.getElementById('invEndDate').value;
    
    if (!startDate || !endDate) return alert("Please select both start and end dates to generate an invoice.");
    
    const btn = document.getElementById('generateBtn');
    btn.innerText = "Generating...";
    
    const res = await apiFetch('/api/invoices', 'POST', { startDate, endDate });
    
    if (res.success) {
        alert(`Success! Generated Invoice ${res.invoiceNo} for ₹${res.totalAmount}`);
        document.getElementById('invStartDate').value = '';
        document.getElementById('invEndDate').value = '';
        initInvoices(); // Refresh the list
    } else {
        alert(res.message);
    }
    btn.innerText = "+ Generate Invoice";
}

async function editInvoice(invoiceNo, currentPaid, totalAmount) {
    const newPaidStr = prompt(
        `Update Collection for ${invoiceNo}\n\nTotal Bill Amount: ₹${totalAmount}\nCurrently Paid: ₹${currentPaid}\n\nEnter the new TOTAL paid amount:`, 
        currentPaid
    );
    
    if (newPaidStr === null) return; // User cancelled
    
    const newPaid = parseFloat(newPaidStr) || 0;
    
    // Auto-calculate the status
    let newStatus = 'PENDING';
    if (newPaid >= totalAmount) newStatus = 'PAID';
    else if (newPaid > 0) newStatus = 'PARTIAL';

    const res = await apiFetch('/api/invoices', 'PATCH', { invoiceNo, status: newStatus, paidAmount: newPaid });
    
    if (res.success) {
        initInvoices(); // Refresh the grid
    } else {
        alert("Failed to update invoice.");
    }
}