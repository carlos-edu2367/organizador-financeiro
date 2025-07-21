import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from .config import settings

def send_email_with_template(to_email: str, template_id: str, template_data: dict):
    """
    Envia um e-mail usando um template dinâmico do SendGrid.
    """
    # Verifica se a chave da API foi configurada no .env
    if not settings.SENDGRID_API_KEY or "SUA_CHAVE_AQUI" in settings.SENDGRID_API_KEY:
        print("--- ERRO: SENDGRID_API_KEY não configurada. E-mail não será enviado. ---")
        # Simula o conteúdo para debug no console, caso a chave não esteja presente
        print(f"--- SIMULAÇÃO DE E-MAIL (para {to_email}) ---")
        print(f"Template ID: {template_id}")
        print(f"Dados: {template_data}")
        print("---------------------------------------------")
        return False

    # Cria a mensagem de e-mail
    message = Mail(
        from_email=settings.SENDGRID_FROM_EMAIL, # E-mail verificado no SendGrid
        to_emails=to_email
    )
    message.template_id = template_id
    message.dynamic_template_data = template_data

    try:
        # Envia o e-mail
        sendgrid_client = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sendgrid_client.send(message)
        print(f"E-mail enviado para {to_email}, Status: {response.status_code}")
        return response.status_code == 202
    except Exception as e:
        print(f"Erro ao enviar e-mail com SendGrid: {e}")
        return False
