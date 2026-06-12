function generateMultiEntryGrid() {
    const tbody = document.getElementById('multiEntryBody');
    tbody.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    
    for(let i = 0; i < 50; i++) {
        tbody.innerHTML += `
            <tr id="row-${i}">
                <td><input type="number" class="b-no" oninput="autoFill(${i})" ${i===0?'required':''}></td>
                <td><input type="date" class="b-date" value="${today}" onchange="fetchRowRate(${i})"></td>
                <td><input type="text" class="b-veh" placeholder="WB..."></td>
                <td>
                    <select class="b-fuel" onchange="fetchRowRate(${i})">
                        <option value="Diesel">Diesel</option>
                        <option value="Petrol">Petrol</option>
                        <option value="Lubricant">Lubricant</option>
                    </select>
                </td>
                <td><input type="number" step="0.01" class="b-qty" oninput="calcRowAmount(${i})"></td>
                <td><input type="number" step="0.01" class="b-rate" readonly style="background: #f1f5f9; color: var(--text-muted);"></td>
                <td><input type="number" step="0.01" class="b-amt" oninput="calcRowQty(${i})"></td>
            </tr>`;
    }
    
    // Fetch rate once for today and populate all rows to prevent 50 API calls on load
    initializeDefaultRates(today);
}

async function initializeDefaultRates(date) {
    const res = await apiFetch(`/api/prices?date=${date}&product=Diesel`);
    const defaultRate = (res && res.rate > 0) ? res.rate : 0;
    
    const rateInputs = document.querySelectorAll('.b-rate');
    for(let i = 0; i < 50; i++) {
        rateInputs[i].value = defaultRate || '';
    }
}

async function fetchRowRate(idx) {
    const date = document.querySelectorAll('.b-date')[idx].value;
    const fuel = document.querySelectorAll('.b-fuel')[idx].value;
    const rateInput = document.querySelectorAll('.b-rate')[idx];
    
    if(!date) return;
    
    rateInput.value = '...';
    const res = await apiFetch(`/api/prices?date=${date}&product=${fuel}`);
    
    if(res && res.rate > 0) {
        rateInput.value = res.rate;
        calcRowAmount(idx); // Recalculate amount if quantity already exists
    } else {
        rateInput.value = '';
    }
}

function calcRowAmount(idx) {
    const qty = parseFloat(document.querySelectorAll('.b-qty')[idx].value) || 0;
    const rate = parseFloat(document.querySelectorAll('.b-rate')[idx].value) || 0;
    if(rate > 0) {
        document.querySelectorAll('.b-amt')[idx].value = (qty * rate).toFixed(2);
    }
}

function calcRowQty(idx) {
    const amt = parseFloat(document.querySelectorAll('.b-amt')[idx].value) || 0;
    const rate = parseFloat(document.querySelectorAll('.b-rate')[idx].value) || 0;
    if(rate > 0) {
        document.querySelectorAll('.b-qty')[idx].value = (amt / rate).toFixed(2);
    }
}

function autoFill(idx) {
    if(idx !== 0) return; // Only auto-fill when the very first bill number is typed
    const startNo = parseInt(document.querySelector('.b-no').value);
    if(isNaN(startNo)) return;
    const inputs = document.querySelectorAll('.b-no');
    for(let i = 1; i < 50; i++) inputs[i].value = startNo + i;
}

async function submitMultiBills() {
    let bills = [];
    const noNodes = document.querySelectorAll('.b-no');
    const dateNodes = document.querySelectorAll('.b-date');
    const vehNodes = document.querySelectorAll('.b-veh');
    const fuelNodes = document.querySelectorAll('.b-fuel');
    const qtyNodes = document.querySelectorAll('.b-qty');
    const rateNodes = document.querySelectorAll('.b-rate');
    const amtNodes = document.querySelectorAll('.b-amt');

    for(let i = 0; i < 50; i++) {
        let no = noNodes[i].value;
        let amt = amtNodes[i].value;
        
        if(no && amt) {
            bills.push({
                billNo: no, 
                date: dateNodes[i].value,
                vehicleNo: vehNodes[i].value,
                fuelType: fuelNodes[i].value,
                quantity: parseFloat(qtyNodes[i].value) || 0,
                rate: parseFloat(rateNodes[i].value) || 0,
                amount: parseFloat(amt)
            });
        }
    }
    
    if(bills.length === 0) return customAlert("No valid bills filled. Please enter at least Bill No and Amount.", "Warning");
    
    const res = await apiFetch('/api/bills', 'POST', bills);
    
    if(res.success) { 
        await customAlert(`${bills.length} Bills Saved Successfully!`, "Success"); 
        generateMultiEntryGrid(); // Clear grid
    } else {
        if(res.needsOverride) {
            let reason = await customPrompt(res.message + "\n\nEnter Admin Override Reason:", "Override Required");
            if(reason) {
                for(let b of bills) b.overrideReason = reason; // Apply override reason to the payload
                const retryRes = await apiFetch('/api/bills', 'POST', bills);
                
                if(retryRes.success) {
                    customAlert("Override applied & Bills Saved.", "Success");
                    generateMultiEntryGrid(); // Clear grid
                } else {
                    customAlert(retryRes.message, "Error");
                }
            }
        } else {
            customAlert(res.message, "Error");
        }
    }
}