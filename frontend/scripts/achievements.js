const API_URL = '/api';

// Mapeia o tipo de medalha para um emoji e uma cor do Tailwind CSS
const medalInfo = {
    'Bronze':   { emoji: '🥉', color: 'text-bronze' },
    'Prata':    { emoji: '🥈', color: 'text-silver' },
    'Ouro':     { emoji: '🥇', color: 'text-gold' },
    'Platina':  { emoji: '💎', color: 'text-platinum' },
    'Diamante': { emoji: '🏆', color: 'text-diamond' }
};

document.addEventListener('DOMContentLoaded', () => {
    fetchAllAchievements();
});

/**
 * Busca todas as conquistas do grupo na API e as renderiza na página.
 */
async function fetchAllAchievements() {
    const token = localStorage.getItem('accessToken');
    const groupId = localStorage.getItem('activeGroupId');

    if (!token || !groupId) {
        window.location.href = '../auth/login_page.html';
        return;
    }

    const container = document.getElementById('all-achievements-container');
    const loadingState = document.getElementById('loading-state');

    try {
        const response = await fetch(`${API_URL}/groups/${groupId}/achievements`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            window.location.href = '../auth/login_page.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Não foi possível carregar as conquistas.');
        }

        const achievements = await response.json();
        
        loadingState.remove();

        if (achievements.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center bg-surface p-8 rounded-lg">
                    <p class="text-gray-400">O seu grupo ainda não ganhou nenhuma medalha.</p>
                    <p class="text-gray-500 text-sm mt-2">Continuem a usar o Clarify para começar a colecionar!</p>
                </div>
            `;
            return;
        }

        achievements.forEach(achievement => {
            const info = medalInfo[achievement.tipo_medalha] || { emoji: '⭐', color: 'text-white' };
            const achievementCard = document.createElement('div');
            achievementCard.className = 'bg-surface p-6 rounded-xl shadow-lg flex flex-col items-center text-center transform hover:scale-105 transition-transform duration-300';
            
            const formattedDate = new Date(achievement.data_conquista).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'long', year: 'numeric'
            });

            achievementCard.innerHTML = `
                <span class="text-7xl">${info.emoji}</span>
                <h3 class="text-2xl font-bold ${info.color} mt-4">${achievement.tipo_medalha}</h3>
                <p class="text-gray-300 mt-2 flex-grow">${achievement.descricao}</p>
                <p class="text-xs text-gray-500 mt-4">Conquistado em ${formattedDate}</p>
            `;
            container.appendChild(achievementCard);
        });

    } catch (error) {
        container.innerHTML = `<div class="col-span-full text-center text-red-400 p-8"><strong>Erro:</strong> ${error.message}</div>`;
    }
}
