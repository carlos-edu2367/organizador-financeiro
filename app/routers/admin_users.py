from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

from .. import database, schemas, models, security

router = APIRouter(
    prefix="/admin/users",
    tags=['Admin - User Management'],
    dependencies=[Depends(security.get_current_collaborator)]
)

# Helper para verificar se o colaborador é um administrador
def require_admin(current_user: models.Colaborador = Depends(security.get_current_collaborator)):
    if current_user.cargo != models.CargoColaboradorEnum.adm:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores.")
    return current_user

@router.get("/", response_model=List[schemas.AdminUserList])
def list_all_users(db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    users = db.query(models.Usuario).options(
        joinedload(models.Usuario.associacoes_grupo).joinedload(models.GrupoMembro.grupo).joinedload(models.Grupo.assinatura)
    ).order_by(models.Usuario.criado_em.desc()).all()

    result = []
    for user in users:
        plano = "gratuito"
        if user.associacoes_grupo:
            grupo = user.associacoes_grupo[0].grupo
            if grupo.assinatura and grupo.assinatura.data_fim > datetime.now(timezone.utc):
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
    user = db.query(models.Usuario).options(
        joinedload(models.Usuario.movimentacoes).joinedload(models.Movimentacao.responsavel),
        joinedload(models.Usuario.associacoes_grupo).joinedload(models.GrupoMembro.grupo).joinedload(models.Grupo.assinatura)
    ).filter(models.Usuario.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    plano = "gratuito"
    if user.associacoes_grupo:
        grupo = user.associacoes_grupo[0].grupo
        if grupo.assinatura and grupo.assinatura.data_fim > datetime.now(timezone.utc):
            plano = "premium"

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
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    if user_update.email:
        user.email = user_update.email
    if user_update.nome:
        user.nome = user_update.nome
    
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/password")
def update_user_password(user_id: str, password_update: schemas.AdminPasswordUpdate, db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    user = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    
    user.senha = security.get_password_hash(password_update.nova_senha)
    db.commit()
    return {"message": "Senha do usuário atualizada com sucesso."}

@router.post("/{user_id}/grant-premium")
def grant_premium_access(user_id: str, grant_data: schemas.AdminGrantPremium, db: Session = Depends(database.get_db), admin: models.Colaborador = Depends(require_admin)):
    user = db.query(models.Usuario).options(
        joinedload(models.Usuario.associacoes_grupo).joinedload(models.GrupoMembro.grupo)
    ).filter(models.Usuario.id == user_id).first()

    if not user or not user.associacoes_grupo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário ou grupo associado não encontrado.")

    grupo = user.associacoes_grupo[0].grupo
    
    # Verifica se já existe uma assinatura
    assinatura = db.query(models.Assinatura).filter(models.Assinatura.grupo_id == grupo.id).first()
    
    now = datetime.now(timezone.utc)
    
    if assinatura and assinatura.data_fim > now:
        # Se já for premium, estende a data
        nova_data_fim = assinatura.data_fim + relativedelta(months=grant_data.meses)
        assinatura.data_fim = nova_data_fim
    else:
        # Se não for premium ou a assinatura expirou, cria uma nova
        nova_data_fim = now + relativedelta(months=grant_data.meses)
        if not assinatura:
            assinatura = models.Assinatura(grupo_id=grupo.id, data_fim=nova_data_fim)
            db.add(assinatura)
        else:
            assinatura.data_fim = nova_data_fim
            assinatura.status = 'ativa'

    grupo.plano = 'premium' # Mantém o campo antigo para consistência, se necessário
    db.commit()
    
    return {"message": f"{grant_data.meses} meses de acesso Premium concedidos ao grupo de {user.nome}. Nova data de expiração: {nova_data_fim.strftime('%d/%m/%Y')}"}
