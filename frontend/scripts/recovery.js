/**
 * Determina a URL base da API com base no ambiente.
 */
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000';
    }
    return '';
};
const API_URL = getApiBaseUrl();

// --- Elementos dos Formulários ---
const forgotPasswordForm = document.getElementById('esqueci-senha-form');
const verifyCodeForm = document.getElementById('verificar-codigo-form');
const resetPasswordForm = document.getElementById('nova-senha-form');

/**
 * Exibe uma mensagem para o usuário.
 */
function showMessage(containerId, message, isError = true) {
    const messageContainer = document.getElementById(containerId);
    if (!messageContainer) return;
    messageContainer.textContent = message;
    messageContainer.className = 'p-3 my-4 rounded-lg text-center text-sm';
    messageContainer.classList.add(isError ? 'bg-red-500/20' : 'bg-green-500/20', isError ? 'text-red-300' : 'text-green-300');
    messageContainer.classList.remove('hidden');
}

// --- Lógica para a página "Esqueci a Senha" ---
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const submitButton = forgotPasswordForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        try {
            const response = await fetch(`${API_URL}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            showMessage('message-container', data.message, false);
            // Redireciona para a página de verificação após um pequeno delay
            setTimeout(() => {
                window.location.href = `./verificar_codigo.html?email=${encodeURIComponent(email)}`;
            }, 2000);
        } catch (error) {
            showMessage('message-container', 'Ocorreu um erro. Tente novamente.', true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Enviar código';
        }
    });
}

// --- Lógica para a página "Verificar Código" ---
if (verifyCodeForm) {
    // Pega o e-mail da URL e exibe para o usuário
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    const emailDisplay = document.getElementById('email-display');
    if (emailDisplay && email) {
        emailDisplay.textContent = `Enviamos um código para ${email}.`;
    }

    verifyCodeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const code = document.getElementById('codigo').value;
        const submitButton = verifyCodeForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Verificando...';

        try {
            const response = await fetch(`${API_URL}/api/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail);
            }
            // Redireciona para a redefinição de senha
            window.location.href = `./nova_senha.html?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
        } catch (error) {
            showMessage('message-container', error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Verificar';
        }
    });
}

// --- Lógica para a página "Nova Senha" ---
if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const params = new URLSearchParams(window.location.search);
        const email = params.get('email');
        const code = params.get('code');
        const newPassword = document.getElementById('nova-senha').value;
        const confirmPassword = document.getElementById('confirmar-senha').value;

        if (newPassword !== confirmPassword) {
            showMessage('message-container', 'As senhas não coincidem.', true);
            return;
        }

        const submitButton = resetPasswordForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Redefinindo...';

        try {
            const response = await fetch(`${API_URL}/api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, new_password: newPassword }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail);
            }
            showMessage('message-container', 'Senha redefinida com sucesso! Redirecionando para o login...', false);
            setTimeout(() => {
                window.location.href = './login_page.html';
            }, 2000);
        } catch (error) {
            showMessage('message-container', error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Redefinir senha';
        }
    });
}
