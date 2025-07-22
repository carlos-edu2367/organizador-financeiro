from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import bleach # INÍCIO DA ALTERAÇÃO: Importa a biblioteca bleach

from .. import database, schemas, models, security

router = APIRouter(
    prefix="/support",
    tags=['Support'],
    dependencies=[Depends(security.get_current_user_from_token)]
)

@router.post("/tickets", status_code=status.HTTP_201_CREATED, response_model=schemas.SuporteChamado)
def create_support_ticket(
    ticket_data: schemas.SuporteChamadoCreate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Cria um novo chamado de suporte para o usuário autenticado.
    """
    # INÍCIO DA ALTERAÇÃO: Sanitiza o título e a descrição
    sanitized_title = bleach.clean(ticket_data.titulo)
    sanitized_description = bleach.clean(ticket_data.descricao)
    # FIM DA ALTERAÇÃO

    new_ticket = models.SuporteChamado(
        titulo=sanitized_title,
        descricao=sanitized_description,
        prioridade=ticket_data.prioridade,
        usuario_id=current_user.id
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Para a resposta, vamos formatar os dados conforme o schema, que espera nomes em vez de IDs
    return {
        "id": new_ticket.id,
        "titulo": new_ticket.titulo,
        "descricao": new_ticket.descricao,
        "status": new_ticket.status,
        "prioridade": new_ticket.prioridade,
        "criado_em": new_ticket.criado_em,
        "nome_usuario": current_user.nome,
        "email_usuario": current_user.email,
        "resolvido_por": None
    }

