
// Define a URL completa da sua API que está rodando no Uvicorn
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    // Se estiver em ambiente de desenvolvimento local, aponta para a porta do Uvicorn.
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    // Em produção, as chamadas são relativas à própria origem (ex: /collaborators/token),
    // então retornamos uma string vazia.
    return '';
};

const API_URL = getApiBaseUrl();


const loginForm = document.getElementById('login-form');
const forgotPasswordLink = document.getElementById('forgot-password-link');

function showMessage(message, isError = true) {
    const container = document.getElementById('message-container');
    container.textContent = message;
    container.className = 'mb-4 p-3 rounded-lg text-center text-sm';
    container.classList.add(isError ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300');
    container.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = document.getElementById('login').value;
    const senha = document.getElementById('senha').value;

    try {
        const response = await fetch(`${API_URL}/collaborators/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, senha }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Erro no login.');
        }

        localStorage.setItem('collaboratorToken', data.access_token);
        window.location.href = './dashboard.html';

    } catch (error) {
        showMessage(error.message);
    }
});

forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    showMessage('Entre em contato com a equipe de TI para redefinir sua senha.', false);
});

// INÍCIO DA ALTERAÇÃO: Verifica se há uma mensagem de logout na URL
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const logoutMessage = urlParams.get('message');
    if (logoutMessage) {
        showMessage(decodeURIComponent(logoutMessage), false); // Exibe a mensagem como sucesso
        // Limpa a URL para evitar que a mensagem apareça novamente ao recarregar
        history.replaceState(null, '', window.location.pathname);
    }
});
// FIM DA ALTERAÇÃO

