const token = localStorage.getItem('collaboratorToken');
if (!token) {
    window.location.href = './login.html';
}

// --- Variáveis Globais ---
let usersChart = null;
let statsData = null;
let allUsers = []; // Armazena a lista completa de usuários

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

        if (targetId === 'usuarios') {
            document.getElementById('user-detail-view').classList.add('hidden');
            document.getElementById('users-list-view').classList.remove('hidden');
            fetchUsers();
        }
    });
});

// --- Lógica do Dashboard (Início) ---
// NOVO: Event listener para o select
const userChartFilter = document.getElementById('user-chart-filter');
userChartFilter.addEventListener('change', (e) => updateUsersChart(e.target.value));

async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/admin/dashboard/stats', {
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
    if (usersChart) usersChart.destroy();
    
    usersChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [], // Inicia vazio, será preenchido pelo update
            datasets: [{
                label: 'Novos Usuários',
                data: [], // Inicia vazio
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#9ca3af', precision: 0 }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
    // Inicia a visualização com o filtro padrão do select ('mes')
    updateUsersChart(userChartFilter.value);
}

function updateUsersChart(period) {
    if (!usersChart || !statsData) return;
    
    let newLabels = [];
    let newData = [];

    switch (period) {
        case 'hoje':
            newLabels = ['Hoje'];
            newData = [statsData.novos_hoje];
            break;
        case 'semana':
            newLabels = ['Esta Semana'];
            newData = [statsData.novos_semana];
            break;
        case 'ano':
            newLabels = ['Este Ano'];
            newData = [statsData.novos_ano];
            break;
        case 'mes':
        default:
            newLabels = ['Este Mês'];
            newData = [statsData.novos_mes];
            break;
    }
    
    usersChart.data.labels = newLabels;
    usersChart.data.datasets[0].data = newData;
    usersChart.update();
}

// --- Lógica de Gerenciamento de Usuários ---
const userSearchInput = document.getElementById('user-search-input');
userSearchInput.addEventListener('input', () => renderUsersTable(allUsers));

async function fetchUsers() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Carregando usuários...</td></tr>';
    try {
        const response = await fetch('/api/admin/users/', {
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
    const searchTerm = userSearchInput.value.toLowerCase();
    tableBody.innerHTML = '';

    const filteredUsers = users.filter(user => 
        user.nome.toLowerCase().includes(searchTerm) || 
        user.email.toLowerCase().includes(searchTerm)
    );

    if (filteredUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    filteredUsers.forEach(user => {
        const row = `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                <td class="p-3">${user.nome}</td>
                <td class="p-3">${user.email}</td>
                <td class="p-3">
                    <span class="px-2 py-1 text-xs rounded-full ${user.plano === 'premium' ? 'bg-gold/20 text-gold' : 'bg-gray-600 text-gray-300'}">
                        ${user.plano.charAt(0).toUpperCase() + user.plano.slice(1)}
                    </span>
                </td>
                <td class="p-3">${new Date(user.criado_em).toLocaleDateString('pt-BR')}</td>
                <td class="p-3">
                    <button onclick="showUserDetails('${user.id}')" class="text-primary-light hover:underline">Ver Detalhes</button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

async function showUserDetails(userId) {
    document.getElementById('users-list-view').classList.add('hidden');
    const detailView = document.getElementById('user-detail-view');
    detailView.innerHTML = '<p class="text-center">Carregando detalhes do usuário...</p>';
    detailView.classList.remove('hidden');

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Não foi possível carregar os detalhes do usuário.');
        const user = await response.json();
        renderUserDetails(user);
    } catch (error) {
        detailView.innerHTML = `<p class="text-center text-red-400">${error.message}</p>`;
    }
}

function renderUserDetails(user) {
    const detailView = document.getElementById('user-detail-view');
    const planInfo = user.plano === 'premium' 
        ? `<span class="px-2 py-1 text-xs rounded-full bg-gold/20 text-gold">Premium</span>`
        : `<span class="px-2 py-1 text-xs rounded-full bg-gray-600 text-gray-300">Gratuito</span>`;

    let transactionsHtml = '<tr><td colspan="4" class="text-center p-4 text-gray-500">Nenhuma movimentação registrada.</td></tr>';
    if(user.movimentacoes.length > 0) {
        transactionsHtml = user.movimentacoes.map(tx => `
            <tr class="border-b border-gray-800">
                <td class="p-2">${new Date(tx.data_transacao).toLocaleDateString('pt-BR')}</td>
                <td class="p-2">${tx.descricao || 'N/A'}</td>
                <td class="p-2">${tx.tipo}</td>
                <td class="p-2">R$ ${Number(tx.valor).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    detailView.innerHTML = `
        <button onclick="closeUserDetails()" class="mb-6 text-primary-light hover:underline"><i class="fas fa-arrow-left mr-2"></i>Voltar para a lista</button>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1 space-y-6">
                <div class="bg-surface p-6 rounded-xl">
                    <h2 class="text-xl font-bold mb-4">Detalhes do Usuário</h2>
                    <p><strong>Nome:</strong> <span id="detail-nome">${user.nome}</span></p>
                    <p><strong>Email:</strong> <span id="detail-email">${user.email}</span></p>
                    <p><strong>Plano:</strong> ${planInfo}</p>
                    <p><strong>Cadastro:</strong> ${new Date(user.criado_em).toLocaleString('pt-BR')}</p>
                </div>
                <div class="bg-surface p-6 rounded-xl">
                    <h2 class="text-xl font-bold mb-4">Ações</h2>
                    <div class="space-y-3">
                        <button onclick="openGrantPremiumModal('${user.id}')" class="w-full p-2 bg-gold/80 text-black font-bold rounded-lg hover:bg-gold">Conceder Premium</button>
                        <button onclick="openEditUserModal('${user.id}', '${user.nome}', '${user.email}')" class="w-full p-2 bg-primary rounded-lg hover:bg-primary-dark">Editar Dados</button>
                        <button onclick="openResetPasswordModal('${user.id}')" class="w-full p-2 bg-danger/80 rounded-lg hover:bg-danger">Resetar Senha</button>
                    </div>
                </div>
            </div>
            <div class="lg:col-span-2 bg-surface p-6 rounded-xl">
                <h2 class="text-xl font-bold mb-4">Histórico de Movimentações</h2>
                <div class="max-h-96 overflow-y-auto">
                    <table class="w-full text-sm">
                        <thead><tr class="border-b border-gray-700"><th class="p-2">Data</th><th class="p-2">Descrição</th><th class="p-2">Tipo</th><th class="p-2">Valor</th></tr></thead>
                        <tbody>${transactionsHtml}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function closeUserDetails() {
    document.getElementById('user-detail-view').classList.add('hidden');
    document.getElementById('users-list-view').classList.remove('hidden');
}

// --- Funções de Ações e Modais ---

function openGrantPremiumModal(userId) {
    const modalTitle = document.getElementById('generic-modal-title');
    const modalContent = document.getElementById('generic-modal-content');
    const modalButtons = document.getElementById('generic-modal-buttons');

    modalTitle.textContent = 'Conceder Acesso Premium';
    modalContent.innerHTML = `
        <label for="premium-months" class="block text-sm text-left mb-2">Número de Meses:</label>
        <input type="number" id="premium-months" min="1" value="1" class="w-full p-2 bg-background rounded-lg border border-gray-700">
    `;
    
    modalButtons.innerHTML = `
        <button id="cancel-modal-btn" class="py-2 px-4 text-gray-300 hover:text-white">Cancelar</button>
        <button id="confirm-modal-btn" class="py-2 px-6 bg-primary hover:bg-primary-dark rounded-lg font-medium text-white">Conceder</button>
    `;

    document.getElementById('cancel-modal-btn').onclick = () => toggleModal('generic-modal', false);
    document.getElementById('confirm-modal-btn').onclick = () => {
        const meses = document.getElementById('premium-months').value;
        executePremiumGrant(userId, meses);
    };

    toggleModal('generic-modal', true);
}

async function executePremiumGrant(userId, meses) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/grant-premium`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ meses: parseInt(meses) })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);
        
        toggleModal('generic-modal', false);
        showCustomAlert('Sucesso', data.message);
        fetchUsers(); // Atualiza a lista
        showUserDetails(userId); // Recarrega os detalhes
    } catch (error) {
        alert(error.message); // Usando alert simples dentro do modal
    }
}

// Implementar openEditUserModal e openResetPasswordModal de forma similar...

// --- Logout ---
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('collaboratorToken');
    window.location.href = './login.html';
});

// --- Inicialização ---
fetchDashboardStats();

// Função genérica para modais (pode ser expandida)
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if(modal) modal.classList.toggle('hidden', !show);
}

function showCustomAlert(title, message) {
    // Implementação simplificada
    alert(`${title}\n\n${message}`);
}
