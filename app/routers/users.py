from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import database, schemas, models, security

router = APIRouter(
    prefix="/users",
    tags=['Users']
)

@router.get("/me", response_model=schemas.UserSessionData)
def read_users_me(
    db: Session = Depends(database.get_db), 
    current_user: models.Usuario = Depends(security.get_current_user_from_token)
):
    """
    Retorna os dados do usuário autenticado, incluindo o plano e o ID
    do seu grupo ATIVO.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar as credenciais",
        )
    
    # --- Lógica para carregar o grupo ativo ---
    user_plan = "gratuito"
    group_id = current_user.grupo_ativo_id

    if group_id:
        # Busca o grupo ativo para obter o plano
        active_group = db.query(models.Grupo).filter(models.Grupo.id == group_id).first()
        if active_group:
            user_plan = active_group.plano
        else:
            # Fallback: se o grupo ativo não for encontrado, limpa o ID
            group_id = None
    
    # Se, por algum motivo, não houver grupo ativo, tenta encontrar o grupo do qual ele é dono
    if not group_id and current_user.associacoes_grupo:
        owner_group_association = next(
            (assoc for assoc in current_user.associacoes_grupo if assoc.papel == 'dono'),
            None
        )
        if owner_group_association:
            group_id = owner_group_association.grupo.id
            user_plan = owner_group_association.grupo.plano
            # Sincroniza o grupo ativo no banco de dados para consistência futura
            current_user.grupo_ativo_id = group_id
            db.commit()

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
    db.delete(current_user)
    db.commit()
    return
