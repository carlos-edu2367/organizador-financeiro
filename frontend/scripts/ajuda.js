/**
 * Determina a URL base da API com base no ambiente (desenvolvimento ou produção).
 * @returns {string} A URL base para as chamadas da API.
 */
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    return '';
};

const API_URL = getApiBaseUrl();

document.addEventListener('DOMContentLoaded', () => {
    // Ajusta os links do header para o dashboard correto (free/premium)
    adjustDashboardLinks();

    const supportForm = document.getElementById('support-ticket-form');
    if (supportForm) {
        supportForm.addEventListener('submit', handleSupportFormSubmit);
    }
});

/**
 * Lida com o envio do formulário de ticket de suporte.
 * @param {Event} event - O evento de submissão do formulário.
 */
async function handleSupportFormSubmit(event) {
    event.preventDefault();
    const token = localStorage.getItem('accessToken');
    if (!token) {
        window.location.href = '../auth/login_page.html';
        return;
    }

    const titleInput = document.getElementById('ticket-title');
    const descriptionInput = document.getElementById('ticket-description');
    const submitButton = event.target.querySelector('button[type="submit"]');

    const userPlan = localStorage.getItem('userPlan');
    const prioridade = userPlan === 'premium' ? 'alta' : 'normal';

    const ticketData = {
        titulo: titleInput.value.trim(),
        descricao: descriptionInput.value.trim(),
        prioridade: prioridade,
    };

    if (!ticketData.titulo || !ticketData.descricao) {
        showMessage('Por favor, preencha todos os campos.', true);
        return;
    }

    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
        const response = await fetch(`${API_URL}/api/support/tickets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ticketData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            // --- INÍCIO DA ALTERAÇÃO: Tratamento de erro aprimorado ---
            let errorMessage = 'Não foi possível enviar o ticket.';
            // Erros de validação do FastAPI vêm como um array em 'detail'
            if (errorData.detail && Array.isArray(errorData.detail)) {
                const firstError = errorData.detail[0];
                const field = firstError.loc ? firstError.loc.slice(-1)[0] : 'campo';
                errorMessage = `Erro no ${field}: ${firstError.msg}`;
            } else if (errorData.detail) {
                // Outros erros que vêm como uma string em 'detail'
                errorMessage = errorData.detail;
            }
            throw new Error(errorMessage);
            // --- FIM DA ALTERAÇÃO ---
        }

        // Limpa o formulário e exibe a mensagem de sucesso
        titleInput.value = '';
        descriptionInput.value = '';
        showMessage('Seu ticket foi enviado com sucesso! Fique atento ao seu e-mail para atualizações.', false);

    } catch (error) {
        showMessage(error.message, true);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

/**
 * Exibe uma mensagem (erro ou sucesso) para o usuário.
 * @param {string} message - A mensagem a ser exibida.
 * @param {boolean} isError - True se for uma mensagem de erro.
 */
function showMessage(message, isError = true) {
    const container = document.getElementById('message-container');
    container.textContent = message;
    container.className = 'p-4 mb-4 rounded-lg text-center font-medium';
    
    if (isError) {
        container.classList.add('bg-red-500/20', 'text-red-300');
    } else {
        container.classList.add('bg-green-500/20', 'text-green-300');
    }
    container.classList.remove('hidden');
}

/**
 * Ajusta os links do header para apontar para o dashboard correto do usuário.
 */
function adjustDashboardLinks() {
    const plan = localStorage.getItem('userPlan');
    const dashboardUrl = plan === 'premium' ? './dashboard_premium.html' : './dashboard_free.html';
    document.getElementById('header-dashboard-link').href = dashboardUrl;
    document.getElementById('back-to-dashboard').href = dashboardUrl;
}
