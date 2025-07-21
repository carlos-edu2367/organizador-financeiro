const token = localStorage.getItem('collaboratorToken');
if (!token) {
    window.location.href = './login.html';
}

/**
 * Determina a URL base da API com base no ambiente (desenvolvimento ou produção).
 */
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    return '';
};
const API_URL = getApiBaseUrl();


// --- Variáveis Globais ---
let usersChart = null;
let allUsers = []; 

// --- Navegação ---
const navLinks = document.querySelectorAll('.nav-link');
const pageContents = document.querySelectorAll('.page-content');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);

        navLinks.forEach(l => l.classList.remove('active', 'bg-surface'));
        link.classList.add('active', 'bg-surface');

        pageContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== targetId);
        });

        if (targetId === 'usuarios') {
            document.getElementById('user-detail-view').classList.add('hidden');
            document.getElementById('users-list-view').classList.remove('hidden');
            fetchUsers();
        }
    });
});

// --- Lógica do Dashboard (Início) ---
const userChartFilter = document.getElementById('user-chart-filter');
userChartFilter.addEventListener('change', (e) => fetchChartData(e.target.value));

async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/collaborators/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar estatísticas.');
        const data = await response.json();
        
        document.getElementById('total-usuarios').textContent = data.total_usuarios;
        document.getElementById('total-premium').textContent = data.total_premium;
        const conversionRate = data.total_usuarios > 0 ? (data.total_premium / data.total_usuarios) * 100 : 0;
        document.getElementById('taxa-conversao').textContent = `${conversionRate.toFixed(1)}%`;

    } catch (error) {
        console.error(error);
        showCustomAlert('Erro', 'Não foi possível carregar as estatísticas do dashboard.');
    }
}

async function fetchChartData(period = 'mes') {
    try {
        const response = await fetch(`${API_URL}/collaborators/dashboard/chart-data?period=${period}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar dados do gráfico.');
        const chartData = await response.json();
        updateUsersChart(chartData.data);
    } catch (error) {
        console.error(error);
        showCustomAlert('Erro', 'Não foi possível carregar os dados do gráfico.');
    }
}

function updateUsersChart(data) {
    const ctx = document.getElementById('users-chart').getContext('2d');
    
    if (usersChart) {
        usersChart.destroy();
    }

    const labels = data.map(d => d.label);
    const newUsersData = data.map(d => d.new_users);
    const newPremiumsData = data.map(d => d.new_premiums);

    usersChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Novos Usuários',
                    data: newUsersData,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)', // primary
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Novos Assinantes Premium',
                    data: newPremiumsData,
                    backgroundColor: 'rgba(250, 204, 21, 0.6)', // gold
                    borderColor: 'rgba(250, 204, 21, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#9ca3af',
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#9ca3af' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#d1d5db' }
                }
            }
        }
    });
}


// --- Lógica de Gerenciamento de Usuários ---

document.getElementById('user-search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.nome.toLowerCase().includes(searchTerm) || 
        user.email.toLowerCase().includes(searchTerm)
    );
    renderUsersTable(filteredUsers);
});

async function fetchUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Carregando usuários...</td></tr>';
    try {
        const response = await fetch(`${API_URL}/api/admin/users/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível carregar a lista de usuários.');
        allUsers = await response.json();
        renderUsersTable(allUsers);
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-400">${error.message}</td></tr>`;
    }
}

function renderUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '';
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Nenhum usuário encontrado.</td></tr>';
        return;
    }
    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-700 hover:bg-surface/50';
        const planClass = user.plano === 'premium' ? 'text-gold font-semibold' : 'text-gray-400';
        row.innerHTML = `
            <td class="p-3">${user.nome}</td>
            <td class="p-3">${user.email}</td>
            <td class="p-3 ${planClass}">${user.plano.charAt(0).toUpperCase() + user.plano.slice(1)}</td>
            <td class="p-3">${new Date(user.criado_em).toLocaleDateString('pt-BR')}</td>
            <td class="p-3">
                <button onclick="showUserDetails('${user.id}')" class="text-primary-light hover:underline">Ver Detalhes</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function showUserDetails(userId) {
    document.getElementById('users-list-view').classList.add('hidden');
    const detailView = document.getElementById('user-detail-view');
    detailView.innerHTML = '<p class="text-center p-8">Carregando detalhes do usuário...</p>';
    detailView.classList.remove('hidden');

    try {
        const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível carregar os detalhes do usuário.');
        const user = await response.json();

        let transactionsHtml = '<p class="text-gray-500 mt-2">Nenhuma movimentação registrada.</p>';
        if (user.movimentacoes.length > 0) {
            transactionsHtml = `
                <div class="overflow-y-auto max-h-80 mt-2">
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="border-b border-gray-600">
                                <th class="p-2">Data</th>
                                <th class="p-2">Descrição</th>
                                <th class="p-2">Tipo</th>
                                <th class="p-2 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${user.movimentacoes.map(tx => `
                                <tr class="border-b border-gray-700">
                                    <td class="p-2">${new Date(tx.data_transacao).toLocaleDateString('pt-BR')}</td>
                                    <td class="p-2">${tx.descricao}</td>
                                    <td class="p-2">${tx.tipo}</td>
                                    <td class="p-2 text-right">R$ ${Number(tx.valor).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const planClass = user.plano === 'premium' ? 'text-gold font-semibold' : 'text-gray-400';
        detailView.innerHTML = `
            <button id="back-to-list-btn" class="text-primary-light hover:underline mb-6"><i class="fas fa-arrow-left mr-2"></i>Voltar para a lista</button>
            <div class="bg-surface p-6 rounded-xl">
                <div class="flex flex-col md:flex-row justify-between md:items-center">
                    <div>
                        <h2 class="text-2xl font-bold">${user.nome}</h2>
                        <p class="text-gray-400">${user.email}</p>
                        <p class="mt-1">Plano: <span class="${planClass}">${user.plano.charAt(0).toUpperCase() + user.plano.slice(1)}</span></p>
                    </div>
                    <div class="flex space-x-2 mt-4 md:mt-0">
                        <button onclick="openPremiumGrantModal('${user.id}', '${user.nome}')" class="bg-gold text-black font-bold py-2 px-4 rounded-lg hover:opacity-80">Conceder Premium</button>
                        <button class="bg-primary py-2 px-4 rounded-lg hover:bg-primary-dark">Editar Dados</button>
                        <button class="bg-danger py-2 px-4 rounded-lg hover:opacity-80">Resetar Senha</button>
                    </div>
                </div>
                <div class="mt-8 border-t border-gray-700 pt-6">
                    <h3 class="text-lg font-semibold">Últimas Movimentações</h3>
                    ${transactionsHtml}
                </div>
            </div>
        `;
        document.getElementById('back-to-list-btn').addEventListener('click', () => {
            detailView.classList.add('hidden');
            document.getElementById('users-list-view').classList.remove('hidden');
        });

    } catch (error) {
        detailView.innerHTML = `<p class="text-center p-8 text-red-400">${error.message}</p>`;
    }
}

function openPremiumGrantModal(userId, userName) {
    const modalContent = document.getElementById('generic-modal-content');
    const modalButtons = document.getElementById('generic-modal-buttons');
    
    document.getElementById('generic-modal-title').textContent = `Conceder Acesso Premium`;
    
    modalContent.innerHTML = `
        <p class="mb-4">Quantos meses de acesso Premium você deseja conceder para <strong>${userName}</strong>?</p>
        <input type="number" id="premium-months-input" min="1" value="1" class="w-full p-2 bg-background rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary">
    `;
    
    modalButtons.innerHTML = `
        <button id="cancel-grant-btn" class="py-2 px-4 text-gray-300 hover:text-white">Cancelar</button>
        <button id="confirm-grant-btn" class="py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white">Confirmar</button>
    `;

    document.getElementById('cancel-grant-btn').onclick = () => toggleModal('generic-modal', false);
    document.getElementById('confirm-grant-btn').onclick = () => {
        const meses = document.getElementById('premium-months-input').value;
        executePremiumGrant(userId, meses);
    };

    toggleModal('generic-modal', true);
}

async function executePremiumGrant(userId, meses) {
    if (!meses || parseInt(meses) < 1) {
        alert("Por favor, insira um número válido de meses.");
        return;
    }
    try {
        const response = await fetch(`${API_URL}/api/admin/users/${userId}/grant-premium`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ meses: parseInt(meses) })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);
        
        toggleModal('generic-modal', false);
        showCustomAlert('Sucesso', data.message);
        showUserDetails(userId); // Recarrega os detalhes para mostrar o plano atualizado
    } catch (error) {
        // Exibe o erro dentro do modal para não fechá-lo
        const modalContent = document.getElementById('generic-modal-content');
        modalContent.innerHTML += `<p class="text-red-400 text-sm mt-2">${error.message}</p>`;
    }
}

// --- Logout ---
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('collaboratorToken');
    window.location.href = './login.html';
});

// --- Funções Utilitárias ---
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.toggle('hidden', !show);
}

function showCustomAlert(title, message) {
    const modalTitle = document.getElementById('generic-modal-title');
    const modalContent = document.getElementById('generic-modal-content');
    const modalButtons = document.getElementById('generic-modal-buttons');
    
    modalTitle.textContent = title;
    modalContent.innerHTML = `<p>${message}</p>`;
    modalButtons.innerHTML = `<button id="ok-alert-btn" class="py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white">OK</button>`;
    
    document.getElementById('ok-alert-btn').onclick = () => toggleModal('generic-modal', false);
    
    toggleModal('generic-modal', true);
}


// --- Inicialização ---
fetchDashboardStats();
fetchChartData(); // Carrega o gráfico inicial (padrão: mês)
