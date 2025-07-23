from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse, JSONResponse
from starlette.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from pathlib import Path

from . import models
from .database import engine
from .routers import auth, users, support, groups, transactions, tasks, ai, collaborators, admin_users, pagamentos

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Clarify API",
    description="API para o organizador financeiro Clarify.",
    version="0.1.0",
)

# --- Define caminhos absolutos para os diretórios estáticos ---
# Isso garante que o FastAPI sempre encontre os arquivos, independentemente de como o servidor é iniciado.
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR_FRONTEND = BASE_DIR / "frontend"
STATIC_DIR_COLLABORATORS = BASE_DIR / "collaborators"

# Configuração de CORS
origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500", # <-- CORRIGIDO o erro de digitação aqui
    # Adicione aqui a URL do seu frontend de produção quando tiver uma.
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas da API para clientes
app.include_router(auth.router)
app.include_router(users.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(pagamentos.router, prefix="/api")

# Rotas da API para colaboradores
app.include_router(collaborators.router)
app.include_router(admin_users.router, prefix="/collaborators")

# Monta a pasta do frontend dos colaboradores
app.mount("/collaborators", StaticFiles(directory=STATIC_DIR_COLLABORATORS, html=True), name="collaborators")

# Monta a pasta do frontend dos clientes (deve ser o último)
app.mount("/", StaticFiles(directory=STATIC_DIR_FRONTEND, html=True), name="static")


# --- INÍCIO DA ALTERAÇÃO: Manipulador de erro 404 inteligente ---
# Este manipulador agora verifica se o arquivo solicitado existe.
# Se existir (como accept_invite.html), ele o serve.
# Se não existir, ele serve o index.html, mantendo o comportamento de SPA.
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    path = request.url.path
    
    # Exclui rotas de API e de colaboradores da lógica de fallback
    if path.startswith('/api/') or path.startswith('/collaborators/'):
        return JSONResponse(
            status_code=404,
            content={"detail": f"O recurso em '{path}' não foi encontrado."}
        )
        
    # Verifica se o arquivo solicitado existe no diretório do frontend
    file_path = STATIC_DIR_FRONTEND / path.lstrip('/')
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
        
    # Se o arquivo não existir, serve o index.html como fallback para o roteamento do lado do cliente
    index_path = STATIC_DIR_FRONTEND / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
        
    # Fallback final se nem o index.html for encontrado
    return JSONResponse(
        status_code=404,
        content={"detail": "Página não encontrada e arquivo index.html de fallback não localizado."}
    )
# --- FIM DA ALTERAÇÃO ---
