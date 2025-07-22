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

# --- Endpoints ---

@router.get("/grupo/{group_id}", response_model=List[schemas.PagamentoAgendado])
def get_pagamentos_agendados_por_grupo(
    group_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Lista todos os pagamentos agendados para um grupo premium.
    """
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    pagamentos = db.query(models.PagamentoAgendado).filter(
        models.PagamentoAgendado.grupo_id == group_id
    ).order_by(models.PagamentoAgendado.data_vencimento.asc()).all()
    return pagamentos

@router.post("/grupo/{group_id}", response_model=schemas.PagamentoAgendado, status_code=status.HTTP_201_CREATED)
def create_pagamento_agendado(
    group_id: str,
    pagamento: schemas.PagamentoAgendadoCreate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Cria um novo pagamento agendado para um grupo premium.
    """
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

# --- INÍCIO DA ALTERAÇÃO: Endpoint para editar um lembrete ---
@router.put("/{pagamento_id}", response_model=schemas.PagamentoAgendado)
def update_pagamento_agendado(
    pagamento_id: str,
    pagamento_update: schemas.PagamentoAgendadoUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Atualiza um pagamento agendado existente.
    """
    db_pagamento = db.query(models.PagamentoAgendado).options(
        joinedload(models.PagamentoAgendado.grupo)
    ).filter(models.PagamentoAgendado.id == pagamento_id).first()

    if not db_pagamento:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    if current_user not in db_pagamento.grupo.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")

    update_data = pagamento_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_pagamento, key, value)
    
    db.commit()
    db.refresh(db_pagamento)
    return db_pagamento
# --- FIM DA ALTERAÇÃO ---

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

    if current_user not in db_pagamento.grupo.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este pagamento.")
    
    db.delete(db_pagamento)
    db.commit()
    return
