from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import database, schemas, models
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/users",
    tags=['Users']
)

@router.get("/me", response_model=schemas.UserSessionData)
def read_users_me(current_user: models.Usuario = Depends(get_current_user_from_token)):
    """
    Retorna os dados do utilizador autenticado, incluindo o plano e o ID
    do seu primeiro grupo.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar as credenciais",
        )
    
    user_plan = "gratuito"
    group_id = None
    
    # Acede ao grupo através do objeto de associação.
    if current_user.associacoes_grupo:
        first_association = current_user.associacoes_grupo[0]
        user_plan = first_association.grupo.plano
        group_id = first_association.grupo.id

    return {
        "id": current_user.id,
        "email": current_user.email,
        "nome": current_user.nome,
        "plano": user_plan,
        "grupo_id": group_id
    }
