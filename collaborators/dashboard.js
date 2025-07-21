const token = localStorage.getItem('collaboratorToken');
if (!token) {
    window.location.href = './login.html';
}

// --- Variáveis Globais ---
let usersChart = null;
let statsData = null;

// --- Navegação ---
const navLinks = document.querySelectorAll('.nav-link');
const pageContents = document.querySelectorAll('.page-content');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        pageContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== targetId);
        });
    });
});

// --- Lógica do Dashboard ---
const userChartFilter = document.getElementById('user-chart-filter');
const filterBtns = userChartFilter.querySelectorAll('.filter-btn');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateUsersChart(btn.dataset.period);
    });
});

async function fetchDashboardStats() {
    try {
        const response = await fetch('/collaborators/dashboard/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao buscar estatísticas.');
        
        statsData = await response.json();
        
        document.getElementById('total-usuarios').textContent = statsData.total_usuarios;
        document.getElementById('total-premium').textContent = statsData.total_premium;
        const conversionRate = statsData.total_usuarios > 0 ? (statsData.total_premium / statsData.total_usuarios * 100).toFixed(1) : 0;
        document.getElementById('taxa-conversao').textContent = `${conversionRate}%`;

        renderUsersChart();

    } catch (error) {
        console.error(error);
    }
}

function renderUsersChart() {
    const ctx = document.getElementById('users-chart').getContext('2d');
    if (usersChart) {
        usersChart.destroy();
    }
    usersChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Hoje', 'Esta Semana', 'Este Mês'],
            datasets: [{
                label: 'Novos Usuários',
                data: [statsData.novos_hoje, statsData.novos_semana, statsData.novos_mes],
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
    updateUsersChart('hoje');
}

function updateUsersChart(period) {
    if (!usersChart || !statsData) return;
    
    let dataToShow = [];
    if (period === 'hoje') {
        dataToShow = [statsData.novos_hoje, 0, 0];
    } else if (period === 'semana') {
        dataToShow = [statsData.novos_hoje, statsData.novos_semana, 0];
    } else { // mes
        dataToShow = [statsData.novos_hoje, statsData.novos_semana, statsData.novos_mes];
    }
    usersChart.data.datasets[0].data = dataToShow;
    usersChart.update();
}

// --- Logout ---
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('collaboratorToken');
    window.location.href = './login.html';
});

// --- Inicialização ---
fetchDashboardStats();
