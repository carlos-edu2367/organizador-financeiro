from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
import logging # INÍCIO DA ALTERAÇÃO: Importa o módulo logging

from .. import database, schemas, models, security

# INÍCIO DA ALTERAÇÃO: Configura o logger
# Obtém um logger para este módulo
logger = logging.getLogger(__name__)
# Configura o nível do logger (pode ser ajustado via configuração em produção)
# Por exemplo, em produção, você pode configurar isso em um arquivo de configuração ou no main.py
if not logger.handlers: # Evita adicionar handlers múltiplos se o arquivo for recarregado
    handler = logging.StreamHandler() # Envia logs para o console
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO) # Define o nível mínimo para INFO
# FIM DA ALTERAÇÃO

router = APIRouter(
    prefix="/admin/users",
    tags=['Admin - User Management'],
    # Todas as rotas neste router requerem que o colaborador seja um administrador
    dependencies=[Depends(security.get_current_collaborator)]
)

# Helper para verificar se o colaborador é um administrador
def require_admin(current_user: models.Colaborador = Depends(security.get_current_collaborator)):
    """
    Verifica se o usuário autenticado é um administrador.
    Esta função é usada como uma dependência para rotas que exigem acesso administrativo.
    """
    if current_user.cargo != models.CargoColaboradorEnum.adm:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores.")
    return current_user

@router.get("/", response_model=List[schemas.AdminUserList])
def list_all_users(db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """
    Lista todos os usuários cadastrados no sistema, incluindo informações sobre o plano.
    Apenas administradores podem acessar esta rota.
    """
    users = db.query(models.Usuario).options(
        joinedload(models.Usuario.associacoes_grupo).joinedload(models.GrupoMembro.grupo).joinedload(models.Grupo.assinatura)
    ).order_by(models.Usuario.criado_em.desc()).all()

    result = []
    for user in users:
        plano = "gratuito"
        # Verifica se o usuário tem um grupo e se a assinatura do grupo está ativa
        if user.associacoes_grupo:
            grupo = user.associacoes_grupo[0].grupo
            # O @property is_premium no modelo Grupo já faz essa verificação de data
            if grupo.is_premium:
                plano = "premium"
        
        result.append({
            "id": user.id,
            "nome": user.nome,
            "email": user.email,
            "criado_em": user.criado_em,
            "plano": plano
        })
    return result

@router.get("/{user_id}", response_model=schemas.AdminUserDetails)
def get_user_details(user_id: str, db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """
    Retorna os detalhes de um usuário específico, incluindo suas movimentações financeiras.
    Apenas administradores podem acessar esta rota.
    """
    user = db.query(models.Usuario).options(
        joinedload(models.Usuario.movimentacoes).joinedload(models.Movimentacao.responsavel),
        joinedload(models.Usuario.associacoes_grupo).joinedload(models.GrupoMembro.grupo).joinedload(models.Grupo.assinatura)
    ).filter(models.Usuario.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    plano = "gratuito"
    if user.associacoes_grupo:
        grupo = user.associacoes_grupo[0].grupo
        if grupo.is_premium: # Reutiliza o @property is_premium
            plano = "premium"

    # Formata as movimentações para inclusão na resposta
    movimentacoes_formatadas = [
        {
            "id": mov.id, "tipo": mov.tipo, "descricao": mov.descricao,
            "valor": mov.valor, "data_transacao": mov.data_transacao,
            "responsavel_nome": mov.responsavel.nome
        } for mov in user.movimentacoes
    ]

    return {
        "id": user.id,
        "nome": user.nome,
        "email": user.email,
        "criado_em": user.criado_em,
        "plano": plano,
        "movimentacoes": movimentacoes_formatadas
    }

@router.put("/{user_id}/details", response_model=schemas.User)
def update_user_details(user_id: str, user_update: schemas.AdminUserUpdate, db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """
    Atualiza os detalhes (nome e/ou e-mail) de um usuário.
    Apenas administradores podem acessar esta rota.
    """
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    # Verifica se o novo e-mail já está em uso por outro usuário
    if user_update.email and user_update.email != user.email:
        existing_user_with_email = db.query(models.Usuario).filter(models.Usuario.email == user_update.email).first()
        if existing_user_with_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este e-mail já está em uso por outro usuário.")
        
        # INÍCIO DA ALTERAÇÃO: Log de auditoria para atualização de e-mail usando logger
        logger.info(f"AUDIT_LOG: Colaborador '{admin.id}' ({admin.email}) atualizou o e-mail do usuário '{user.id}' de '{user.email}' para '{user_update.email}'.")
        # FIM DA ALTERAÇÃO
        user.email = user_update.email
    
    if user_update.nome:
        # INÍCIO DA ALTERAÇÃO: Log de auditoria para atualização de nome usando logger
        logger.info(f"AUDIT_LOG: Colaborador '{admin.id}' ({admin.email}) atualizou o nome do usuário '{user.id}' de '{user.nome}' para '{user_update.nome}'.")
        # FIM DA ALTERAÇÃO
        user.nome = user_update.nome
    
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/password")
def update_user_password(user_id: str, password_update: schemas.AdminPasswordUpdate, db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """
    Redefine a senha de um usuário.
    Apenas administradores podem acessar esta rota.
    """
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    
    # Hash da nova senha antes de salvar
    user.senha = security.get_password_hash(password_update.nova_senha)
    db.commit()

    # INÍCIO DA ALTERAÇÃO: Log de auditoria para redefinição de senha usando logger
    logger.info(f"AUDIT_LOG: Colaborador '{admin.id}' ({admin.email}) redefiniu a senha do usuário '{user.id}' ({user.email}).")
    # FIM DA ALTERAÇÃO

    return {"message": "Senha do usuário atualizada com sucesso."}

@router.post("/{user_id}/grant-premium")
def grant_premium_access(user_id: str, grant_data: schemas.AdminGrantPremium, db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    """
    Concede ou estende o acesso Premium para o grupo de um usuário.
    Apenas administradores podem acessar esta rota.
    """
    user = db.query(models.Usuario).options(
        joinedload(models.Usuario.associacoes_grupo).joinedload(models.GrupoMembro.grupo)
    ).filter(models.Usuario.id == user_id).first()

    if not user or not user.associacoes_grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário ou grupo associado não encontrado.")

    grupo = user.associacoes_grupo[0].grupo
    
    # Verifica se já existe uma assinatura para o grupo
    assinatura = db.query(models.Assinatura).filter(models.Assinatura.grupo_id == grupo.id).first()
    
    now = datetime.now(timezone.utc)
    
    if assinatura and assinatura.data_fim > now:
        # Se já for premium e a assinatura estiver ativa, estende a data de fim
        nova_data_fim = assinatura.data_fim + relativedelta(months=grant_data.meses)
        assinatura.data_fim = nova_data_fim
        assinatura.status = 'ativa' # Garante que o status seja 'ativa'
        # INÍCIO DA ALTERAÇÃO: Log de auditoria para extensão de premium usando logger
        logger.info(f"AUDIT_LOG: Colaborador '{admin.id}' ({admin.email}) estendeu o acesso Premium do grupo '{grupo.id}' (usuário '{user.id}') por {grant_data.meses} meses. Nova data de fim: {nova_data_fim.strftime('%d/%m/%Y')}.")
        # FIM DA ALTERAÇÃO
    else:
        # Se não for premium ou a assinatura expirou, cria uma nova ou reativa
        nova_data_fim = now + relativedelta(months=grant_data.meses)
        if not assinatura:
            # Cria uma nova assinatura se não existir
            assinatura = models.Assinatura(grupo_id=grupo.id, data_fim=nova_data_fim, status='ativa')
            db.add(assinatura)
            # INÍCIO DA ALTERAÇÃO: Log de auditoria para concessão de novo premium usando logger
            logger.info(f"AUDIT_LOG: Colaborador '{admin.id}' ({admin.email}) concedeu acesso Premium ao grupo '{grupo.id}' (usuário '{user.id}') por {grant_data.meses} meses. Data de fim: {nova_data_fim.strftime('%d/%m/%Y')}.")
            # FIM DA ALTERAÇÃO
        else:
            # Reativa uma assinatura existente e atualiza a data de fim
            assinatura.data_fim = nova_data_fim
            assinatura.status = 'ativa'
            # INÍCIO DA ALTERAÇÃO: Log de auditoria para reativação de premium usando logger
            logger.info(f"AUDIT_LOG: Colaborador '{admin.id}' ({admin.email}) reativou o acesso Premium do grupo '{grupo.id}' (usuário '{user.id}') por {grant_data.meses} meses. Nova data de fim: {nova_data_fim.strftime('%d/%m/%Y')}.")
            # FIM DA ALTERAÇÃO

    grupo.plano = 'premium' # Atualiza o campo 'plano' no modelo Grupo para consistência
    db.commit()
    
    return {"message": f"{grant_data.meses} meses de acesso Premium concedidos ao grupo de {user.nome}. Nova data de expiração: {nova_data_fim.strftime('%d/%m/%Y')}"}

