from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import database, schemas, models
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/groups",
    tags=['Groups'],
    dependencies=[Depends(get_current_user_from_token)]
)

@router.get("/{group_id}/dashboard", response_model=schemas.DashboardData)
def get_dashboard_data(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")
    if current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    movimentacoes = db.query(models.Movimentacao).filter(models.Movimentacao.grupo_id == group_id).order_by(models.Movimentacao.data_transacao.desc()).limit(10).all()
    movimentacoes_com_responsavel = []
    for mov in movimentacoes:
        movimentacoes_com_responsavel.append({
            "id": mov.id, "tipo": mov.tipo, "descricao": mov.descricao, "valor": mov.valor,
            "data_transacao": mov.data_transacao, "responsavel_nome": mov.responsavel.nome
        })

    meta_ativa = db.query(models.Meta).filter(models.Meta.grupo_id == group_id, models.Meta.status == 'ativa').first()

    dashboard_data = {
        "nome_utilizador": current_user.nome, "nome_grupo": group.nome, "plano": group.plano,
        "membros": group.membros, "movimentacoes_recentes": movimentacoes_com_responsavel,
        "meta_ativa": meta_ativa
    }
    return dashboard_data


@router.post("/{group_id}/goals", response_model=schemas.Meta, status_code=status.HTTP_201_CREATED)
def create_goal_for_group(
    group_id: str,
    goal: schemas.GoalCreate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(get_current_user_from_token)
):
    """
    Cria uma nova meta para um grupo, com validação de plano.
    """
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")
    if current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    # Validação da regra de negócio para o plano gratuito
    if group.plano == 'gratuito':
        existing_goal = db.query(models.Meta).filter(models.Meta.grupo_id == group_id, models.Meta.status == 'ativa').first()
        if existing_goal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="O plano gratuito permite apenas uma meta ativa por vez. Faça o upgrade para Premium."
            )

    db_goal = models.Meta(
        titulo=goal.titulo,
        valor_meta=goal.valor_meta,
        data_limite=goal.data_limite,
        grupo_id=group_id
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal
