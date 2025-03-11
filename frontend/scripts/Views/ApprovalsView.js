// Global variable to store all approval entries across employees.
let allApprovalEntries = [];

/**
 * Fetch and aggregate approval entries for all employees.
 * @returns {Promise<void>}
 */
async function loadApprovalsView() {
  try {
    const employees = await fetch(apiUrl + "employees").then(parseResponse);
    if (!employees || employees.length === 0) {
      document.getElementById("approvalsContainer").innerHTML = "<p>No employees found.</p>";
      return;
    }

    // For each employee, fetch their data and attach employee info.
    const dataPromises = employees.map(emp => fetchEmployeeApprovalData(emp));
    const results = await Promise.all(dataPromises);
    allApprovalEntries = results.flat();

    // Render the approval tabs using the aggregated data.
    renderApprovalTabsFromFiltered(allApprovalEntries);
  } catch (error) {
    console.error("Error fetching employees for approvals:", error);
  }
}

/**
 * Fetch punch clock data for a single employee and enrich each entry with employee info.
 * @param {Object} emp - The employee object.
 * @returns {Promise<Array>}
 */
async function fetchEmployeeApprovalData(emp) {
  try {
    let data = await fetch(apiUrl + "employee/" + emp.code).then(parseResponse);
    if (!Array.isArray(data)) data = [data];
    // Enrich each entry with the employee name and code.
    return data.map(entry => ({
      ...entry,
      employeeName: emp.name,
      employeeCode: emp.code,
    }));
  } catch (error) {
    console.error(`Error fetching data for employee ${emp.code}:`, error);
    return [];
  }
}

/**
 * Filter approval entries by status and render the corresponding tables.
 * @param {Array} entries - The aggregated approval entries.
 */
function renderApprovalTabsFromFiltered(entries) {
  const pendingEntries = entries.filter(entry => entry.status === "pending");
  const rejectedEntries = entries.filter(entry => entry.status === "rejected");
  const approvedEntries = entries.filter(entry => entry.status === "approved");

  renderApprovalsTable("pendingContainer", pendingEntries, true);
  renderApprovalsTable("rejectedContainer", rejectedEntries, false);
  renderApprovalsTable("approvedContainer", approvedEntries, false);
}

/**
 * Build and render a table of approval entries into a container.
 * @param {string} containerId - ID of the container element.
 * @param {Array} entries - Approval entries to render.
 * @param {boolean} showActions - Whether to display action buttons.
 */
function renderApprovalsTable(containerId, entries, showActions) {
  const container = document.getElementById(containerId);
  if (!entries || entries.length === 0) {
    container.innerHTML = "<p>No entries found.</p>";
    return;
  }

  // Build the table header.
  const actionHeader = showActions ? "<th>Actions</th>" : "";
  let html = `
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Date</th>
          <th>Punch In</th>
          <th>Punch Out</th>
          <th>Overtime</th>
          ${actionHeader}
        </tr>
      </thead>
      <tbody>
  `;

  // Build each table row.
  entries.forEach(entry => {
    const punchIn = entry.punchIn ? formatTimeString(entry.punchIn) : "N/A";
    const punchOut = entry.punchOut ? formatTimeString(entry.punchOut) : "N/A";
    const overtime = entry.overtime ? formatTimeString(entry.overtime) : "N/A";
    const statusBadge = `<span class="badge ${
      entry.status === 'approved' ? 'bg-success' :
      entry.status === 'rejected' ? 'bg-danger' :
      'bg-warning text-dark'
    }">${entry.status || "N/A"}</span>`;

    let actionButtons = "";
    if (showActions) {
      actionButtons = `
        <button class="btn btn-sm btn-success action-btn approve-btn" 
                data-employee-code="${entry.employeeCode}" 
                data-date="${entry.date}" 
                data-punchin="${entry.punchIn}" 
                title="Approve">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="btn btn-sm btn-danger action-btn reject-btn" 
                data-employee-code="${entry.employeeCode}" 
                data-date="${entry.date}" 
                data-punchin="${entry.punchIn}" 
                title="Reject">
          <i class="fa-solid fa-times"></i>
        </button>
      `;
    }

    html += `
      <tr>
        <td>${entry.employeeName}</td>
        <td>${formatDateToWords(entry.date)}</td>
        <td>${punchIn}</td>
        <td>${punchOut}</td>
        <td>${overtime}</td>
        ${showActions ? `<td>${actionButtons}</td>` : ""}
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;
  container.innerHTML = html;

  // Attach event listeners for the action buttons if applicable.
  if (showActions) {
    container.querySelectorAll(".approve-btn").forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const empCode = btn.getAttribute("data-employee-code");
        updateApprovalActionInApprovals(btn, empCode, "approved", loadApprovalsView);
      });
    });
    container.querySelectorAll(".reject-btn").forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const empCode = btn.getAttribute("data-employee-code");
        updateApprovalActionInApprovals(btn, empCode, "rejected", loadApprovalsView);
      });
    });
  }
}

// Listen for changes in the approvals search field.
document.getElementById("approvalsSearchInput").addEventListener("input", function() {
  const searchTerm = this.value;
  const filtered = filterEntries(allApprovalEntries, searchTerm);
  renderApprovalTabsFromFiltered(filtered);
});

// Finally, call loadApprovalsView() on script load.
loadApprovalsView();