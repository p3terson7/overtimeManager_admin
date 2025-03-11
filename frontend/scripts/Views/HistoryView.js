// Global variable to store all history entries.
let allHistoryEntries = [];

/**
 * Fetch history entries from the backend and render them.
 */
async function fetchHistory() {
  try {
    const response = await fetch(apiUrl + "history");
    const historyEntries = await response.json();
    allHistoryEntries = historyEntries; // store for search
    renderHistoryTabs(historyEntries);
  } catch (error) {
    console.error("Error fetching history:", error);
    showToast("Error fetching history", "error");
  }
}

/**
 * Format a timestamp into a friendly string.
 * For example, "2025-03-04 14:25:00" becomes "March 04, 2025 14h 25".
 * @param {string} timestamp - The original timestamp.
 * @returns {string} The formatted timestamp.
 */
function formatHistoryTimestamp(timestamp) {
  if (!timestamp) return "N/A";
  const parts = timestamp.split(" ");
  if (parts.length < 2) return timestamp;
  const datePart = parts[0];
  const timePart = parts[1];
  return `${formatDateToWords(datePart)} ${formatTimeString(timePart)}`;
}

/**
 * Filter an array of history entries based on a search term.
 * Searches in timestamp, action, employee, and message.
 * @param {Array} entries - Array of history log entries.
 * @param {string} searchTerm - The search term.
 * @returns {Array} The filtered array.
 */
function filterHistoryEntries(entries, searchTerm) {
  const tokens = searchTerm.toLowerCase().split(/\s+/).filter(token => token.length > 0);
  if (tokens.length === 0) return entries;
  return entries.filter(entry => {
    const combinedText = (
      entry.timestamp + " " + entry.action + " " + entry.employee + " " + entry.message
    ).toLowerCase();
    return tokens.every(token => combinedText.includes(token));
  });
}

/**
 * Render history tabs for different action types.
 * This function divides the entries into tabs (All, Add, Update, Approve/Reject, Delete).
 * @param {Array} historyEntries - Array of history entries.
 */
function renderHistoryTabs(historyEntries) {
  // Get container elements for each tab.
  const allContainer = document.getElementById("allHistoryContainer");
  const addContainer = document.getElementById("addHistoryContainer");
  const editContainer = document.getElementById("editHistoryContainer");
  const approveContainer = document.getElementById("approveHistoryContainer");
  const deleteContainer = document.getElementById("deleteHistoryContainer");

  // Helper: Render a table of history entries into a container.
  function renderTable(container, entries) {
    // Sort entries from latest to oldest.
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!entries || entries.length === 0) {
      container.innerHTML = "<p>No entries found.</p>";
      return;
    }

    let html = `
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Employee</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
    `;

    entries.forEach(entry => {
      html += `
        <tr>
          <td class="td-history">${formatHistoryTimestamp(entry.timestamp)}</td>
          <td style="width: 40px; height: 40px;">${getActionButtonHtml(entry.action)}</td>
          <td>${entry.employee}</td>
          <td>${entry.message}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  }

  // Render each tab by filtering based on the action type.
  renderTable(allContainer, historyEntries);
  renderTable(addContainer, historyEntries.filter(e => e.action.toLowerCase() === "add"));
  renderTable(editContainer, historyEntries.filter(e => e.action.toLowerCase() === "update"));
  renderTable(approveContainer, historyEntries.filter(e => {
    const act = e.action.toLowerCase();
    return act === "approved" || act === "rejected";
  }));
  renderTable(deleteContainer, historyEntries.filter(e => e.action.toLowerCase() === "delete"));
}

// Attach an event listener to the history search input.
document.getElementById("historySearchInput").addEventListener("input", function() {
  const searchTerm = this.value;
  const filtered = filterHistoryEntries(allHistoryEntries, searchTerm);
  renderHistoryTabs(filtered);
});

// Initially fetch history on page load.
fetchHistory();

function getActionButtonHtml(action) {
  if (!action) return "";
  const act = action.toLowerCase();
  if (act === "approved") {
    return '<button class="btn btn-sm btn-success action-btn history-btn" disabled><i class="fa-solid fa-check"></i></button>';
  } else if (act === "rejected") {
    return '<button class="btn btn-sm btn-danger action-btn history-btn" disabled><i class="fa-solid fa-times"></i></button>';
  } else if (act === "add") {
    return '<button class="btn btn-sm btn-warning action-btn history-btn" disabled><i class="fa-solid fa-add"></i></button>';
  } else if (act === "update") {
    return '<button class="btn btn-sm btn-primary action-btn history-btn" disabled><i class="fa-solid fa-pen"></i></button>';
  } else if (act === "delete") {
    return '<button class="btn btn-sm btn-secondary action-btn history-btn" disabled><i class="fa-solid fa-trash"></i></button>';
  } else {
    // Fallback: return the action text if no match.
    return `<span>${action}</span>`;
  }
}