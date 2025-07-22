from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timezone

from .. import database, schemas, models, security

router = APIRouter(
    prefix="/pagamentos",
    tags=['Pagamentos Agendados'],
    dependencies=[Depends(security.get_current_user_from_token)]
)

# --- Dependência de Verificação (usada apenas para GET agora) ---
def get_group_and_verify_membership(
    group_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
) -> models.Grupo:
    """
    Busca um grupo, verifica se o usuário atual é membro e retorna o grupo.
    """
    group = db.query(models.Grupo).options(
        joinedload(models.Grupo.associacoes_membros).joinedload(models.GrupoMembro.usuario),
        joinedload(models.Grupo.assinatura) # Carrega a assinatura para verificar o plano
    ).filter(models.Grupo.id == group_id).first()

    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")

    if current_user not in group.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    # Verifica se o grupo é Premium
    if not group.is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta funcionalidade está disponível apenas para assinantes do plano Premium."
        )

    return group

# --- Endpoints ---

@router.get("/grupo/{group_id}", response_model=List[schemas.PagamentoAgendado])
def get_pagamentos_agendados_por_grupo(
    group_id: str,
    db: Session = Depends(database.get_db),
    group: models.Grupo = Depends(get_group_and_verify_membership)
):
    """
    Lista todos os pagamentos agendados para um grupo premium.
    """
    pagamentos = db.query(models.PagamentoAgendado).filter(
        models.PagamentoAgendado.grupo_id == group_id
    ).order_by(models.PagamentoAgendado.data_vencimento.asc()).all()
    return pagamentos

# --- INÍCIO DA CORREÇÃO ---
@router.post("/grupo/{group_id}", response_model=schemas.PagamentoAgendado, status_code=status.HTTP_201_CREATED)
def create_pagamento_agendado(
    group_id: str,
    pagamento: schemas.PagamentoAgendadoCreate,
    db: Session = Depends(database.get_db),
    # A dependência 'get_group_and_verify_membership' foi removida para evitar conflitos com o corpo da requisição POST.
    # A verificação agora é feita manualmente abaixo, seguindo o padrão de outras rotas do projeto.
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Cria um novo pagamento agendado para um grupo premium.
    """
    # Busca o grupo e verifica manualmente se o usuário é membro e se o plano é premium.
    group = db.query(models.Grupo).options(
        joinedload(models.Grupo.associacoes_membros),
        joinedload(models.Grupo.assinatura)
    ).filter(models.Grupo.id == group_id).first()

    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")

    if current_user not in group.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    if not group.is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta funcionalidade está disponível apenas para assinantes do plano Premium."
        )

    db_pagamento = models.PagamentoAgendado(**pagamento.model_dump(), grupo_id=group_id)
    db.add(db_pagamento)
    db.commit()
    db.refresh(db_pagamento)
    return db_pagamento
# --- FIM DA CORREÇÃO ---

@router.put("/{pagamento_id}/marcar-pago", response_model=schemas.PagamentoAgendado)
def marcar_como_pago(
    pagamento_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Marca um pagamento agendado como 'pago'.
    """
    db_pagamento = db.query(models.PagamentoAgendado).options(
        joinedload(models.PagamentoAgendado.grupo)
    ).filter(models.PagamentoAgendado.id == pagamento_id).first()

    if not db_pagamento:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    
    # Verifica se o usuário pertence ao grupo do pagamento
    if current_user not in db_pagamento.grupo.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este pagamento.")
    
    db_pagamento.status = models.StatusPagamentoEnum.pago
    db_pagamento.data_pagamento = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_pagamento)
    return db_pagamento

@router.delete("/{pagamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pagamento_agendado(
    pagamento_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Apaga um pagamento agendado.
    """
    db_pagamento = db.query(models.PagamentoAgendado).options(
        joinedload(models.PagamentoAgendado.grupo)
    ).filter(models.PagamentoAgendado.id == pagamento_id).first()

    if not db_pagamento:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    # Verifica se o usuário pertence ao grupo do pagamento
    if current_user not in db_pagamento.grupo.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este pagamento.")
    
    db.delete(db_pagamento)
    db.commit()
    return
