from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import database, schemas, models
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/groups",
    tags=['Groups'],
    # Todas as rotas neste ficheiro exigirão um token válido.
    dependencies=[Depends(get_current_user_from_token)]
)

@router.get("/{group_id}/dashboard", response_model=schemas.DashboardData)
def get_dashboard_data(group_id: str, db: Session = Depends(database.get_db), current_user: models.Usuario = Depends(get_current_user_from_token)):
    """
    Endpoint principal para obter todos os dados necessários para o dashboard.
    """
    # 1. Procura o grupo no banco de dados.
    group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grupo não encontrado.")

    # 2. Verifica se o utilizador atual pertence a este grupo (Segurança!).
    if current_user not in group.membros:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso não permitido a este grupo.")

    # 3. Busca as movimentações recentes do grupo.
    movimentacoes = db.query(models.Movimentacao).filter(models.Movimentacao.grupo_id == group_id).order_by(models.Movimentacao.data_transacao.desc()).limit(10).all()
    
    # Prepara a lista de movimentações para o schema, incluindo o nome do responsável.
    movimentacoes_com_responsavel = []
    for mov in movimentacoes:
        movimentacoes_com_responsavel.append({
            "id": mov.id,
            "tipo": mov.tipo,
            "descricao": mov.descricao,
            "valor": mov.valor,
            "data_transacao": mov.data_transacao,
            "responsavel_nome": mov.responsavel.nome # Acede ao nome através da relationship
        })

    # 4. Busca a meta ativa do grupo.
    meta_ativa = db.query(models.Meta).filter(models.Meta.grupo_id == group_id, models.Meta.status == 'ativa').first()

    # 5. Monta o objeto de resposta final com todos os dados.
    dashboard_data = {
        "nome_utilizador": current_user.nome,
        "nome_grupo": group.nome,
        "plano": group.plano,
        "membros": group.membros,
        "movimentacoes_recentes": movimentacoes_com_responsavel,
        "meta_ativa": meta_ativa
    }

    return dashboard_data

