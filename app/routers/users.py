from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import database, schemas, models
# CORREÇÃO: Importa a função com o nome correto do módulo de segurança.
from ..security import get_current_user_from_token

router = APIRouter(
    prefix="/users", # Todas as rotas aqui começarão com /users
    tags=['Users']
)

# Este endpoint é protegido. O FastAPI garantirá que só pode ser acedido
# com um token JWT válido.
@router.get("/me", response_model=schemas.UserWithPlan)
def read_users_me(current_user: models.Usuario = Depends(get_current_user_from_token)):
    """
    Retorna os dados do utilizador atualmente autenticado,
    incluindo o plano do seu primeiro grupo.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar as credenciais",
        )
    
    # Lógica simples para encontrar o plano do primeiro grupo do utilizador.
    # Numa aplicação real, a lógica para determinar o grupo "ativo" pode ser mais complexa.
    user_plan = "gratuito" # Padrão
    if current_user.grupos:
        user_plan = current_user.grupos[0].plano

    # Retorna os dados do utilizador juntamente com o plano.
    return {
        "id": current_user.id,
        "email": current_user.email,
        "nome": current_user.nome,
        "plano": user_plan
    }
