// Filtering / Formatting / Refactoring Logic

function filterEntries(entries, searchTerm) {
    const tokens = searchTerm.toLowerCase().split(/\s+/).filter(token => token.length > 0);
    if (tokens.length === 0) return entries;
    return entries.filter(entry => {
        const formattedDate = formatDateToWords(entry.date);
        const combinedText = (entry.employeeName + " " + entry.date + " " + formattedDate).toLowerCase();
        return tokens.every(token => combinedText.includes(token));
    });
}

function formatTimeString(timeStr) {
  if (!timeStr) return "N/A";
  const parts = timeStr.split(':');
  return parts[0] + "h " + parts[1];
}

// Helper function to normalize a time string to "HH:mm" format. Avoids a bug in DashbordView.js
function normalizeTime(timeString) {
  // Assumes timeString is in "HH:mm:ss" format.
  return timeString ? timeString.slice(0, 5) : "";
}

function formatDateToWords(dateString) {
  const parts = dateString.split("-");
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function convertFormattedTimeToBackend(timeStr) {
  if (!timeStr) return "";
  const cleaned = timeStr.replace(/\s+/g, "").replace("h", ":");
  if (cleaned.split(":").length === 2) {
    return cleaned + ":00";
  }
  return cleaned;
}

function updateTotalOvertime(data) {
    let totalSeconds = 0;
    data.forEach(entry => {
      if (entry.overtime && entry.overtime !== "N/A") {
        const parts = entry.overtime.split(':').map(Number);
        totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    });
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    document.getElementById("totalOvertime").innerText =
      `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}`;
}

function parseResponse(response) {
    if (!response.ok) {
      return response.text().then(text => { throw new Error(text); });
    }
    return response.json();
}

function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toastContainer");
  const toastId = "toast" + Date.now();

  const iconHtml = type === "success" ?
    '<img src="assets/successtoast.png" class="img" style="width: 10px; height: auto; border-radius: 1px;">' :
    type === "error" ?
    '<img src="assets/errortoast.png" class="img" style="width: 10px; height: auto; border-radius: 1px;">' :
    '<i class="fa-solid fa-info-circle icon-info"></i>';

  const toast = document.createElement("div");
  toast.id = toastId;
  toast.className = "toast custom-toast";
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");
  
  toast.innerHTML = `
    <div class="toast-header">
      ${iconHtml}
      <strong class="me-auto">System</strong>
      <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;

  toastContainer.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 4000 });
  bsToast.show();
  toast.addEventListener('hidden.bs.toast', () => { toast.remove(); });
}