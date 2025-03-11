// Save active view in localStorage when switching views.
function showView(viewId) {
  // Remove "active" class from all views and nav links.
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  document.querySelectorAll('.navbar-nav .nav-link').forEach(link => link.classList.remove('active'));

  // Set the active nav link.
  if (viewId === 'dashboardView') {
    document.getElementById('navDashboard').classList.add('active');
  } else if (viewId === 'employeesView') {
    document.getElementById('navEmployees').classList.add('active');
  } else if (viewId === 'adminView') {
    document.getElementById('navAdmin').classList.add('active');
  }
  // Save the active view.
  localStorage.setItem('activeView', viewId);
}

// When the page loads, restore the active view.
window.addEventListener('load', () => {
  const savedView = localStorage.getItem('activeView') || 'dashboardView';
  showView(savedView);
});

document.getElementById('navDashboard').addEventListener('click', (e) => {
  e.preventDefault();
  showView('dashboardView');
  localStorage.setItem('activeView', 'dashboardView');
  fetchEmployees();
  fetchEmployeeData();
});
document.getElementById('navEmployees').addEventListener('click', (e) => {
  e.preventDefault();
  showView('employeesView');
  localStorage.setItem('activeView', 'employeesView');
  loadEmployeesView();
});
document.getElementById('navAdmin').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.setItem('activeView', 'adminView');
  showView('adminView');
});

// When the page loads, restore the active view.
window.addEventListener('load', () => {
  const savedView = localStorage.getItem('activeView') || 'dashboardView';
  showView(savedView);
});