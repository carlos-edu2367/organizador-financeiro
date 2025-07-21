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
        const response = await fetch('/collaborators/token', {
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
