// Loads up a table with Employee names.
function loadEmployeesView() {
    fetch(apiUrl + "employees")
      .then(parseResponse)
      .then(employee => {
        const tbody = document.getElementById("employeesTableBody");
        tbody.innerHTML = "";
        if (!employee || employee.length === 0) {
          tbody.innerHTML = "<tr><td>No employees found.</td></tr>";
        } else {
          employee.forEach(emp => {
            tbody.innerHTML += `<tr><td>${emp.name}</td></tr>`;
          });
        }
      })
    .catch(error => console.error("Error loading employees view:", error));
}

loadEmployeesView();