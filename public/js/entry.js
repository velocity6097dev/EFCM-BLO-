function generateMultiEntryGrid() {
    const tbody = document.getElementById('multiEntryBody');
    tbody.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    for(let i = 0; i < 50; i++) {
        tbody.innerHTML += `
            <tr id="row-${i}">
                <td><input type="number" class="b-no" oninput="autoFill(${i})" ${i===0?'required':''}></td>
                <td><input type="date" class="b-date" value="${today}"></td>
                <td><input type="text" class="b-veh"></td>
                <td><select class="b-fuel"><option>Diesel</option><option>Petrol</option></select></td>
                <td><input type="number" step="0.01" class="b-amt"></td>
            </tr>`;
    }
}

function autoFill(idx) {
    if(idx !== 0) return;
    const startNo = parseInt(document.querySelector('.b-no').value);
    if(isNaN(startNo)) return;
    const inputs = document.querySelectorAll('.b-no');
    for(let i = 1; i < 50; i++) inputs[i].value = startNo + i;
}

async function submitMultiBills() {
    let bills = [];
    for(let i = 0; i < 50; i++) {
        let no = document.querySelectorAll('.b-no')[i].value;
        let amt = document.querySelectorAll('.b-amt')[i].value;
        if(no && amt) {
            bills.push({
                billNo: no, 
                date: document.querySelectorAll('.b-date')[i].value,
                vehicleNo: document.querySelectorAll('.b-veh')[i].value,
                fuelType: document.querySelectorAll('.b-fuel')[i].value,
                amount: parseFloat(amt)
            });
        }
    }
    if(bills.length === 0) return alert("No valid bills filled.");
    
    const res = await apiFetch('/api/bills', 'POST', bills);
    if(res.success) { alert("Bills Saved!"); generateMultiEntryGrid(); }
    else {
        if(res.needsOverride) {
            let reason = prompt(res.message + "\nEnter Admin Override Reason:");
            if(reason) {
                bills[0].overrideReason = reason; // Apply to first failing bill for simplicity
                await apiFetch('/api/bills', 'POST', bills);
                alert("Override applied.");
            }
        } else alert(res.message);
    }
}