import os
import uuid
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Carga variables desde archivo .env si existe
load_dotenv()

# Configuración mediante variables de entorno
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
TABLE_NAME = os.getenv("DYNAMODB_TABLE", "url_shortener")
APP_BASE_URL = os.getenv("APP_BASE_URL", "").strip()

app = FastAPI(
    title="URL Shortener API",
    description="API REST para acortar URLs con AWS DynamoDB y EC2",
    version="1.0.0"
)

# Configuración de CORS para permitir peticiones desde S3 o cualquier origen
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cliente DynamoDB usando Boto3 (en EC2 tomará credenciales del Rol IAM automáticamente)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)


class URLRequest(BaseModel):
    original_url: str


@app.get("/", tags=["Health"])
def health_check():
    """Endpoint de estado para verificar que el servicio está activo."""
    return {
        "status": "online",
        "service": "URL Shortener API",
        "table": TABLE_NAME,
        "region": AWS_REGION
    }


@app.post("/shorten", status_code=200, tags=["Shortener"])
def create_short_url(req: URLRequest, request: Request):
    """
    Endpoint 1: Recibe la URL original, genera un identificador UUID,
    lo guarda en DynamoDB y retorna el enlace corto generado.
    """
    original_url = req.original_url.strip()

    # Validación básica de protocolo
    if not (original_url.startswith("http://") or original_url.startswith("https://")):
        raise HTTPException(
            status_code=400,
            detail="La URL debe comenzar con http:// o https://"
        )

    short_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        table.put_item(
            Item={
                'short_code': short_id,
                'original_url': original_url,
                'created_at': created_at
            }
        )
    except ClientError as e:
        error_msg = e.response.get('Error', {}).get('Message', str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error en DynamoDB: {error_msg}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error interno del servidor: {str(e)}"
        )

    # Determinar la URL base: variable de entorno APP_BASE_URL o request.base_url
    base_url = APP_BASE_URL.rstrip('/') if APP_BASE_URL else str(request.base_url).rstrip('/')

    return {
        "short_code": short_id,
        "original_url": original_url,
        "short_url": f"{base_url}/{short_id}"
    }


@app.get("/urls/{short_code}", tags=["Shortener"])
def get_url_info(short_code: str):
    """
    Endpoint 3: Consulta la información del enlace por short_code (UUID)
    y retorna la información en formato JSON.
    (Definido antes de /{short_code} para evitar conflictos de rutas).
    """
    try:
        response = table.get_item(Key={'short_code': short_code})
    except ClientError as e:
        error_msg = e.response.get('Error', {}).get('Message', str(e))
        raise HTTPException(status_code=500, detail=f"Error en DynamoDB: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

    if 'Item' not in response:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")

    return response['Item']


@app.get("/{short_code}", response_class=RedirectResponse, status_code=307, tags=["Shortener"])
def redirect_to_original(short_code: str):
    """
    Endpoint 2: Recibe el UUID (short_code), consulta DynamoDB y realiza
    una redirección HTTP 307 al destino original.
    """
    try:
        response = table.get_item(Key={'short_code': short_code})
    except ClientError as e:
        error_msg = e.response.get('Error', {}).get('Message', str(e))
        raise HTTPException(status_code=500, detail=f"Error en DynamoDB: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

    if 'Item' not in response:
        raise HTTPException(status_code=404, detail="URL no encontrada")

    original_url = response['Item'].get('original_url')
    if not original_url:
        raise HTTPException(status_code=404, detail="Registro sin URL destino")

    return RedirectResponse(url=original_url, status_code=307)
