from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from decimal import Decimal
import datetime

from .. import database, schemas, models
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/transactions",
    tags=['Transactions'],
    dependencies=[Depends(get_current_user_from_token)]
)

@router.post("/group/{group_id}", response_model=schemas.Movimentacao, status_code=status.HTTP_201_CREATED)
def create_transaction(
    group_id: str,
    transaction: schemas.TransactionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(get_current_user_from_token)
):
    """Cria uma nova transação manual para um grupo."""
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    # CORREÇÃO: Usando a propriedade renomeada 'member_list'
    if not group or current_user not in group.member_list:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    responsavel = db.query(models.Usuario).filter(models.Usuario.id == transaction.responsavel_id).first()
    if not responsavel or responsavel not in group.member_list:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Responsável inválido.")

    # CORREÇÃO: Prepara o dicionário de dados antes de criar o objeto.
    transaction_data = transaction.model_dump()
    # Converte o valor de float para Decimal, que é o tipo esperado pelo modelo.
    transaction_data['valor'] = Decimal(str(transaction_data['valor']))

    # Cria a instância do modelo usando o dicionário preparado e adiciona o grupo_id.
    db_transaction = models.Movimentacao(
        **transaction_data,
        grupo_id=group_id
    )
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    
    # Prepara a resposta para corresponder ao schema 'Movimentacao'
    return {
        "id": db_transaction.id,
        "tipo": db_transaction.tipo,
        "descricao": db_transaction.descricao,
        "valor": db_transaction.valor,
        "data_transacao": db_transaction.data_transacao,
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

    # Atualiza os campos
    update_data = transaction.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == 'valor':
            setattr(db_transaction, key, Decimal(str(value)))
        else:
            setattr(db_transaction, key, value)

    db.commit()
    db.refresh(db_transaction)
    
    return {
        "id": db_transaction.id,
        "tipo": db_transaction.tipo,
        "descricao": db_transaction.descricao,
        "valor": db_transaction.valor,
        "data_transacao": db_transaction.data_transacao,
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
