# Acortador de Enlaces Serverless/Cloud en AWS
**Midterm - Arquitectura Cloud y DevOps**

Aplicación web distribuida para acortar enlaces utilizando los servicios gestionados de **Amazon Web Services**:
- **Amazon S3:** Alojamiento web estático de la interfaz de usuario (HTML, CSS, JavaScript nativo).
- **Amazon EC2:** Servidor Linux con FastAPI y Uvicorn para la lógica de negocio y redirecciones HTTP.
- **Amazon DynamoDB:** Base de datos NoSQL para la persistencia de las URLs y sus identificadores UUID.
- **AWS IAM Role:** Gestión segura de permisos sin credenciales quemadas en el código.

---

## 🏛 Arquitectura de la Solución

```mermaid
flowchart LR
    User([Usuario / Navegador])
    S3[Amazon S3\nHosting Estático]
    EC2[Amazon EC2\nFastAPI en Puerto 8000]
    Dynamo[Amazon DynamoDB\nTabla: url_shortener]

    User -->|1. Carga interfaz| S3
    User -->|2. POST /shorten| EC2
    EC2 -->|3. Guarda UUID + URL| Dynamo
    User -->|4. GET /{uuid}| EC2
    EC2 -->|5. Consulta URL original| Dynamo
    EC2 -->|6. Redirección HTTP 307| User
```

---

## 📁 Estructura del Repositorio

```text
URLshortener/
├── .gitignore             # Archivos ignorados (venv, credenciales, etc.)
├── README.md              # Documentación técnica del proyecto
├── backend/
│   ├── .env.example       # Plantilla de variables de entorno
│   ├── main.py            # API REST FastAPI y cliente Boto3
│   └── requirements.txt   # Dependencias de Python
└── frontend/
    ├── index.html         # Interfaz web de usuario
    ├── style.css          # Estilos y diseño responsivo
    └── app.js             # Lógica cliente (fetch, validaciones, portapapeles)
```

---

## ⚙️ Variables de Entorno (Backend)

Crea un archivo `.env` dentro de la carpeta `backend/` con las siguientes variables:

```env
AWS_REGION=us-east-1
DYNAMODB_TABLE=url_shortener
APP_BASE_URL=http://<IP-PUBLICA-EC2>:8000
```

---

## 🚀 Endpoints de la API (FastAPI)

| Método | Ruta | Descripción | Código Éxito |
|---|---|---|---|
| `GET` | `/` | Health check del backend | `200 OK` |
| `POST` | `/shorten` | Genera un enlace acortado con UUID | `200 OK` |
| `GET` | `/{short_code}` | Redirección 307 a la URL destino | `307 Temporary Redirect` |
| `GET` | `/urls/{short_code}` | Consulta los metadatos del enlace | `200 OK` |

---

## 🛠 Despliegue en Amazon EC2 (Backend)

1. **Conectar a la instancia mediante SSH:**
   ```bash
   ssh -i "tu-llave.pem" ubuntu@<IP-PUBLICA-EC2>
   ```

2. **Actualizar el sistema e instalar dependencias:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y python3 python3-pip python3-venv git
   ```

3. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/GusArielZarate/URLshortener.git
   cd URLshortener/backend
   ```

4. **Crear y activar el entorno virtual:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. **Configurar el archivo `.env`:**
   ```bash
   cp .env.example .env
   nano .env
   # Reemplaza APP_BASE_URL con tu IP pública de EC2: http://<IP-PUBLICA-EC2>:8000
   ```

6. **Configurar Systemd para ejecución continua:**
   Crea el archivo de servicio:
   ```bash
   sudo nano /etc/systemd/system/urlshortener.service
   ```
   Contenido:
   ```ini
   [Unit]
   Description=FastAPI URL Shortener Service
   After=network.target

   [Service]
   User=ubuntu
   WorkingDirectory=/home/ubuntu/URLshortener/backend
   EnvironmentFile=/home/ubuntu/URLshortener/backend/.env
   ExecStart=/home/ubuntu/URLshortener/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

   Iniciar y habilitar el servicio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start urlshortener
   sudo systemctl enable urlshortener
   sudo systemctl status urlshortener
   ```

---

## 🪣 Despliegue en Amazon S3 (Frontend)

1. Crear un bucket en S3 (ej. `mi-acortador-url-2026`).
2. Desmarcar **"Bloquear todo el acceso público"** (Block all public access).
3. Habilitar **Static website hosting** en las propiedades del bucket:
   - Documento de índice: `index.html`
4. Agregar la siguiente Política de Bucket (Bucket Policy) en la pestaña **Permisos**:
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Sid": "PublicReadGetObject",
               "Effect": "Allow",
               "Principal": "*",
               "Action": "s3:GetObject",
               "Resource": "arn:aws:s3:::NOMBRE_DE_TU_BUCKET/*"
           }
       ]
   }
   ```
5. Subir los archivos `index.html`, `style.css` y `app.js` de la carpeta `frontend/`.
6. En `app.js` o directamente en la interfaz web, coloca la IP pública de tu backend EC2 (`http://<IP-PUBLICA-EC2>:8000`).
