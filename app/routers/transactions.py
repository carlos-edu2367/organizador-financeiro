from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal
from datetime import date
import bleach
import html # INÍCIO DA ALTERAÇÃO: Importa a biblioteca html

from .. import database, schemas, models
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/transactions",
    tags=['Transactions'],
    dependencies=[Depends(get_current_user_from_token)]
)

@router.get("/group/{group_id}/full_history", response_model=List[schemas.Movimentacao])
def get_full_transaction_history(
    group_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    transaction_type: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(get_current_user_from_token)
):
    """Busca o histórico de transações completo para um grupo, com filtros."""
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    query = db.query(models.Movimentacao).filter(models.Movimentacao.grupo_id == group_id)

    if start_date:
        query = query.filter(models.Movimentacao.data_transacao >= start_date)
    if end_date:
        query = query.filter(models.Movimentacao.data_transacao <= end_date)
    if transaction_type:
        query = query.filter(models.Movimentacao.tipo == transaction_type)

    transactions = query.order_by(models.Movimentacao.data_transacao.desc()).all()
    
    return [
        {
            "id": tx.id, "tipo": tx.tipo, "descricao": tx.descricao,
            "valor": tx.valor, "data_transacao": tx.data_transacao,
            "responsavel_nome": tx.responsavel.nome
        } for tx in transactions
    ]


@router.post("/group/{group_id}", response_model=schemas.Movimentacao, status_code=status.HTTP_201_CREATED)
def create_transaction(
    group_id: str,
    transaction: schemas.TransactionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(get_current_user_from_token)
):
    """Cria uma nova transação manual para um grupo."""
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group or current_user not in group.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    responsavel = db.query(models.Usuario).filter(models.Usuario.id == transaction.responsavel_id).first()
    if not responsavel or responsavel not in group.member_list:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Responsável inválido.")

    transaction_data = transaction.model_dump()
    transaction_data['valor'] = Decimal(str(transaction_data['valor']))

    # INÍCIO DA ALTERAÇÃO: Decodifica entidades HTML antes de sanitizar
    transaction_data['descricao'] = bleach.clean(html.unescape(transaction_data['descricao'])) if transaction_data['descricao'] else None
    # FIM DA ALTERAÇÃO

    db_transaction = models.Movimentacao(
        **transaction_data,
        grupo_id=group_id
    )
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    
    return {
        "id": db_transaction.id, "tipo": db_transaction.tipo, "descricao": db_transaction.descricao,
        "valor": db_transaction.valor, "data_transacao": db_transaction.data_transacao,
        "responsavel_nome": db_transaction.responsavel.nome
    }

@router.put("/{transaction_id}", response_model=schemas.Movimentacao)
def update_transaction(
    transaction_id: str,
    transaction: schemas.TransactionUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(get_current_user_from_token)
):
    """Atualiza uma transação existente."""
    db_transaction = db.query(models.Movimentacao).options(joinedload(models.Movimentacao.grupo)).filter(models.Movimentacao.id == transaction_id).first()
    if not db_transaction or current_user not in db_transaction.grupo.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")

    update_data = transaction.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == 'valor':
            setattr(db_transaction, key, Decimal(str(value)))
        # INÍCIO DA ALTERAÇÃO: Decodifica entidades HTML antes de sanitizar
        elif key == 'descricao':
            setattr(db_transaction, key, bleach.clean(html.unescape(value)) if value else None)
        # FIM DA ALTERAÇÃO
        else:
            setattr(db_transaction, key, value)

    db.commit()
    db.refresh(db_transaction)
    
    return {
        "id": db_transaction.id, "tipo": db_transaction.tipo, "descricao": db_transaction.descricao,
        "valor": db_transaction.valor, "data_transacao": db_transaction.data_transacao,
        "responsavel_nome": db_transaction.responsavel.nome
    }

@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(get_current_user_from_token)
):
    """Apaga uma transação."""
    db_transaction = db.query(models.Movimentacao).options(joinedload(models.Movimentacao.grupo)).filter(models.Movimentacao.id == transaction_id).first()
    if not db_transaction or current_user not in db_transaction.grupo.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido.")
    
    db.delete(db_transaction)
    db.commit()
    return

