// ========= Helper Functions =========

// Build HTML for the employee dropdown options.
function buildEmployeeOptions(employees) {
  return `<option value="">Select an employee</option>` +
         employees.map(emp => `<option value="${emp.code}">${emp.name}</option>`).join("");
}

// Sort entries by date.
function sortEntries(entries, latestFirst) {
  return entries.sort((a, b) => latestFirst 
    ? new Date(b.date) - new Date(a.date)
    : new Date(a.date) - new Date(b.date)
  );
}

// Group entries by their date.
function groupEntriesByDate(entries) {
  return entries.reduce((acc, entry) => {
    acc[entry.date] = acc[entry.date] || [];
    acc[entry.date].push(entry);
    return acc;
  }, {});
}

// Create a card element for a given date and its entries.
function createEntryCard(date, entries) {
  const header = formatDateToWords(date);
  // Build the table rows for this date.
  const rowsHtml = entries.map(entry => `
    <tr>
      <td>${entry.punchIn ? formatTimeString(entry.punchIn) : "N/A"}</td>
      <td>${entry.punchOut ? formatTimeString(entry.punchOut) : "N/A"}</td>
      <td>${entry.overtime ? formatTimeString(entry.overtime) : "N/A"}</td>
      <td>
        <span class="badge ${
          entry.status === 'approved'
            ? 'bg-success'
            : entry.status === 'rejected'
            ? 'bg-danger'
            : 'bg-warning text-dark'
        }">
          ${entry.status || "N/A"}
        </span>
      </td>
      <td>
        ${
          entry.status === "pending"
            ? `
              <button class="btn btn-sm action-btn approve-btn" data-date="${entry.date}" data-punchin="${entry.punchIn}" title="Approve">
                <i class="fa-solid fa-check"></i>
              </button>
              <button class="btn btn-sm action-btn reject-btn" data-date="${entry.date}" data-punchin="${entry.punchIn}" title="Reject">
                <i class="fa-solid fa-times"></i>
              </button>
            `
            : `
              <button class="btn btn-sm action-btn update-button text-muted" data-date="${entry.date}" data-punchin="${entry.punchIn}" data-punchout="${entry.punchOut || ''}" data-overtime="${entry.overtime || ''}" title="Update">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn btn-sm action-btn delete-button text-muted" data-date="${entry.date}" data-punchin="${entry.punchIn}" title="Delete">
                <i class="fa-solid fa-trash"></i>
              </button>
            `
        }
      </td>
    </tr>
  `).join("");

  const card = document.createElement("div");
  card.className = "card mb-3";
  card.innerHTML = `
    <div class="card-header">${header}</div>
    <div class="card-body">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Overtime</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
  return card;
}

// Attach event listeners to action buttons within the entries container.
function attachActionListeners() {
  document.querySelectorAll('.update-button').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openUpdateModal(btn);
    });
  });
  document.querySelectorAll('.delete-button').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteEntry(btn);
    });
  });
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      updateApprovalAction(btn, "approved");
    });
  });
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      updateApprovalAction(btn, "rejected");
    });
  });
}

// ========= Main Functions =========

async function fetchEmployees() {
  try {
    const response = await fetch(apiUrl + "employees");
    const employees = await parseResponse(response);
    const employeeSelect = document.getElementById("employeeSelect");
    employeeSelect.innerHTML = buildEmployeeOptions(employees);
    document.getElementById("activeEmployees").innerText = employees.length;

    // Restore selected employee from localStorage.
    const savedEmployee = localStorage.getItem('selectedEmployee');
    if (savedEmployee) {
      employeeSelect.value = savedEmployee;
      fetchEmployeeData();
    }
  } catch (error) {
    console.error("Error fetching employees:", error);
  }
}

document.getElementById("employeeSelect").addEventListener("change", () => {
  const selectedEmployee = document.getElementById("employeeSelect").value;
  localStorage.setItem('selectedEmployee', selectedEmployee);
  fetchEmployeeData();
});

async function fetchEmployeeData() {
  const employeeCode = document.getElementById("employeeSelect").value;
  const selectedMonth = document.getElementById("monthFilter").value;
  const selectedYear = document.getElementById("yearFilter").value;
  const latestCheck = document.getElementById("latestCheck").checked;
  const container = document.getElementById("punchClockEntries");

  if (!employeeCode) {
    container.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(apiUrl + "employee/" + employeeCode);
    let data = await parseResponse(response);
    if (!Array.isArray(data)) { data = [data]; }

    // Filter by month and year.
    let filtered = data.filter(entry => {
      const dt = new Date(entry.date);
      return (!selectedMonth || (dt.getMonth() + 1) == selectedMonth) &&
             (!selectedYear || dt.getFullYear() == selectedYear);
    });

    // Sort entries.
    filtered = sortEntries(filtered, latestCheck);

    // Update pending count.
    const pendingCount = filtered.filter(entry => entry.status === "pending").length;
    document.getElementById("pendingApprovals").innerText = pendingCount;

    // Group entries by date.
    const grouped = groupEntriesByDate(filtered);
    container.innerHTML = "";
    Object.entries(grouped).forEach(([date, entries]) => {
      container.appendChild(createEntryCard(date, entries));
    });
    
    if (filtered.length === 0) {
      container.innerHTML = `<div class="text-center text-muted">No punch clock entries found.</div>`;
    }
    
    attachActionListeners();
    updateTotalOvertime(filtered);
  } catch (error) {
    console.error("Error fetching employee data:", error);
    showToast("Error fetching overtime entries.", "error");
  }
}

// ========= Add Entry Modal Logic =========

function openAddEntryModal() {
  document.getElementById("addEntryDate").value = new Date().toISOString().slice(0, 10);
  // Clear time input fields.
  ["addPunchInHours", "addPunchInMinutes", "addPunchOutHours", "addPunchOutMinutes"].forEach(id => {
    document.getElementById(id).value = "";
  });
  const addModal = new bootstrap.Modal(document.getElementById("addEntryModal"));
  addModal.show();
}

document.getElementById("addEntryButton").addEventListener("click", openAddEntryModal);

document.getElementById("saveAddEntryBtn").addEventListener("click", async function () {
  const employeeCode = document.getElementById("employeeSelect").value;
  const date = document.getElementById("addEntryDate").value;
  if (!employeeCode || !date) {
    showToast("Please select an employee and a date.", "error");
    return;
  }
  
  const punchInHours = document.getElementById("addPunchInHours").value.trim();
  const punchInMinutes = document.getElementById("addPunchInMinutes").value.trim();
  const punchOutHours = document.getElementById("addPunchOutHours").value.trim();
  const punchOutMinutes = document.getElementById("addPunchOutMinutes").value.trim();
  
  if (!punchInHours || !punchInMinutes || !punchOutHours || !punchOutMinutes) {
    showToast("Please fill in all hour and minute fields.", "error");
    return;
  }
  
  const twoDigitRegex = /^[0-9]{1,2}$/;
  if (!twoDigitRegex.test(punchInHours) ||
      !twoDigitRegex.test(punchInMinutes) ||
      !twoDigitRegex.test(punchOutHours) ||
      !twoDigitRegex.test(punchOutMinutes)) {
    showToast("Hours and minutes must be numeric and up to 2 digits.", "error");
    return;
  }
  
  const punchInTime = `${punchInHours.padStart(2, '0')}:${punchInMinutes.padStart(2, '0')}:00`;
  const punchOutTime = `${punchOutHours.padStart(2, '0')}:${punchOutMinutes.padStart(2, '0')}:00`;
  const punchInDateTime = new Date(`${date}T${punchInTime}`);
  const punchOutDateTime = new Date(`${date}T${punchOutTime}`);
  
  if (punchOutDateTime <= punchInDateTime) {
    showToast("Punch Out must be after Punch In.", "error");
    return;
  }
  
  const payload = { date, punchIn: punchInTime, punchOut: punchOutTime, status: "pending" };
  
  try {
    const response = await fetch(apiUrl + "employee/add/" + employeeCode, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await parseResponse(response);
    const addModal = bootstrap.Modal.getInstance(document.getElementById("addEntryModal"));
    addModal.hide();
    fetchEmployeeData();
    showToast(data.message, "success");
  } catch (error) {
    console.error("Error adding entry:", error);
    showToast("Error adding entry: " + error.message, "error");
  }
});

// ========= Update & Delete Logic =========

function openUpdateModal(button) {
  const employeeCode = document.getElementById("employeeSelect").value;
  const date = button.getAttribute("data-date");
  const originalPunchIn = button.getAttribute("data-punchin");
  const currentPunchOut = button.getAttribute("data-punchout");

  document.getElementById("updateDate").value = date;
  document.getElementById("originalPunchIn").value = originalPunchIn;
  document.getElementById("originalPunchOut").value = currentPunchOut;

  if (originalPunchIn) {
    const [hours, minutes] = originalPunchIn.split(':');
    document.getElementById("updatePunchInHours").value = hours;
    document.getElementById("updatePunchInMinutes").value = minutes;
  } else {
    document.getElementById("updatePunchInHours").value = "";
    document.getElementById("updatePunchInMinutes").value = "";
  }

  if (currentPunchOut) {
    const [hours, minutes] = currentPunchOut.split(':');
    document.getElementById("updatePunchOutHours").value = hours;
    document.getElementById("updatePunchOutMinutes").value = minutes;
  } else {
    document.getElementById("updatePunchOutHours").value = "";
    document.getElementById("updatePunchOutMinutes").value = "";
  }

  const updateModal = new bootstrap.Modal(document.getElementById("updateEntryModal"));
  updateModal.show();
}

document.getElementById("saveUpdateBtn").addEventListener("click", async function () {
  const employeeCode = document.getElementById("employeeSelect").value;
  const date = document.getElementById("updateDate").value;
  const originalPunchIn = document.getElementById("originalPunchIn").value;
  const originalPunchOut = document.getElementById("originalPunchOut").value || null;

  const punchInHours = document.getElementById("updatePunchInHours").value.trim();
  const punchInMinutes = document.getElementById("updatePunchInMinutes").value.trim();
  const punchOutHours = document.getElementById("updatePunchOutHours").value.trim();
  const punchOutMinutes = document.getElementById("updatePunchOutMinutes").value.trim();

  if (!punchInHours || !punchInMinutes || !punchOutHours || !punchOutMinutes) {
    showToast("Please fill in all hour and minute fields.", "error");
    return;
  }
  
  const twoDigitRegex = /^[0-9]{1,2}$/;
  if (!twoDigitRegex.test(punchInHours) ||
      !twoDigitRegex.test(punchInMinutes) ||
      !twoDigitRegex.test(punchOutHours) ||
      !twoDigitRegex.test(punchOutMinutes)) {
    showToast("Hours and minutes must be numeric and up to 2 digits.", "error");
    return;
  }
  
  const newPunchInBackend = `${punchInHours.padStart(2, '0')}:${punchInMinutes.padStart(2, '0')}:00`;
  const punchOutBackend = `${punchOutHours.padStart(2, '0')}:${punchOutMinutes.padStart(2, '0')}:00`;

  if (newPunchInBackend === originalPunchIn && (originalPunchOut === null || punchOutBackend === originalPunchOut)) {
    showToast("No changes detected.", "info");
    return;
  }
  
  const punchInDateTime = new Date(`${date}T${newPunchInBackend}`);
  const punchOutDateTime = new Date(`${date}T${punchOutBackend}`);
  if (punchOutDateTime <= punchInDateTime) {
    showToast("Punch Out must be after Punch In.", "error");
    return;
  }
  
  const payload = { date, originalPunchIn, newPunchIn: newPunchInBackend, punchOut: punchOutBackend };
  
  try {
    const response = await fetch(apiUrl + "employee/" + employeeCode, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await parseResponse(response);
    const updateModal = bootstrap.Modal.getInstance(document.getElementById("updateEntryModal"));
    updateModal.hide();
    fetchEmployeeData();
    showToast(data.message, "success");
  } catch (error) {
    console.error("Error updating entry:", error);
    showToast("Error updating entry: " + error.message, "error");
  }
});

async function deleteEntry(button) {
  const employeeCode = document.getElementById("employeeSelect").value;
  const date = button.getAttribute("data-date");
  const punchIn = button.getAttribute("data-punchin");

  if (!confirm("Are you sure you want to delete this entry?")) return;
  try {
    const response = await fetch(apiUrl + "employee/" + employeeCode + "?date=" + encodeURIComponent(date) + "&punchIn=" + encodeURIComponent(punchIn), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    await parseResponse(response);
    showToast("Entry deleted successfully.", "success");
    fetchEmployeeData();
  } catch (error) {
    console.error("Error deleting entry:", error);
    showToast("Error deleting entry: " + error.message, "error");
  }
}

async function updateApprovalAction(button, newStatus) {
  const employeeCode = document.getElementById("employeeSelect").value;
  const date = button.getAttribute("data-date");
  const punchIn = button.getAttribute("data-punchin");
  try {
    const response = await fetch(apiUrl + "employee/approval/" + employeeCode, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, punchIn, status: newStatus })
    });
    await parseResponse(response);
    showToast("Entry updated successfully.", "success");
    fetchEmployeeData();
  } catch (error) {
    console.error("Approval update error:", error);
    showToast("Error updating entry: " + error.message, "error");
  }
}

async function updateApprovalActionInApprovals(button, employeeCode, newStatus) {
  const date = button.getAttribute("data-date");
  const punchIn = button.getAttribute("data-punchin");
  try {
    const response = await fetch(apiUrl + "employee/approval/" + employeeCode, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, punchIn, status: newStatus })
    });
    await parseResponse(response);
    showToast("Entry updated successfully.", "success");
    loadApprovalsView();
  } catch (error) {
    console.error("Approval update error in Approvals view:", error);
    showToast("Error updating entry", "error");
  }
}

// ========= Event Listeners for Filters =========
document.getElementById("monthFilter").addEventListener("input", fetchEmployeeData);
document.getElementById("yearFilter").addEventListener("input", fetchEmployeeData);
document.getElementById("latestCheck").addEventListener("change", fetchEmployeeData);

// ========= Initial Fetch =========
fetchEmployees();