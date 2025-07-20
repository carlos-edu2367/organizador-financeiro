from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import database, schemas, models, security

router = APIRouter(
    prefix="/users",
    tags=['Users']
)

@router.get("/me", response_model=schemas.UserSessionData)
def read_users_me(current_user: models.Usuario = Depends(security.get_current_user_from_token)):
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

@router.post("/verify-password", response_model=schemas.PasswordVerifyResponse)
def verify_user_password(
    password_data: schemas.PasswordVerify,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """Verifica se a senha fornecida pelo usuário é válida."""
    if not security.verify_password(password_data.password, current_user.senha):
        return {"verified": False}
    return {"verified": True}

@router.put("/me", response_model=schemas.User)
def update_user_me(
    user_update: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """Atualiza o nome e/ou e-mail do usuário autenticado."""
    if user_update.email and user_update.email != current_user.email:
        existing_user = db.query(models.Usuario).filter(models.Usuario.email == user_update.email).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este e-mail já está em uso.")
        current_user.email = user_update.email

    if user_update.nome:
        current_user.nome = user_update.nome
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/me/password")
def update_user_password(
    password_update: schemas.PasswordUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """Atualiza a senha do usuário autenticado."""
    if not security.verify_password(password_update.current_password, current_user.senha):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A senha atual está incorreta.")
    
    hashed_password = security.get_password_hash(password_update.new_password)
    current_user.senha = hashed_password
    db.commit()
    return {"message": "Senha atualizada com sucesso."}

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_me(
    db: Session = Depends(database.get_db),
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """Apaga a conta do usuário autenticado."""
    # O cascade no model deve apagar as associações e, consequentemente, o grupo se ele for o único dono.
    db.delete(current_user)
    db.commit()
    return
