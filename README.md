# 📸 Wedding Gallery App

Una aplicación web simple para bodas donde los invitados pueden subir y compartir fotos y videos sin necesidad de registro o autenticación.

## 🚀 Características

- **Sin autenticación**: Los usuarios pueden subir contenido sin crear cuentas
- **Galería compartida**: Todos los archivos se almacenan en una galería común
- **Soporte multimedia**: Imágenes (JPEG, PNG, GIF, WebP) y videos (MP4, MOV, AVI, WebM)
- **Almacenamiento en S3**: Los archivos se guardan en Amazon S3 para escalabilidad
- **API REST**: Endpoints para subir, listar y gestionar archivos
- **Panel de administración**: Moderación básica de contenido
- **Deduplicación**: Evita archivos duplicados usando hash SHA256

## 🛠️ Tecnologías

- **Backend**: Django 5.2.6 + Django REST Framework
- **Base de datos**: MySQL 8.0
- **Almacenamiento**: Amazon S3
- **Procesamiento de imágenes**: Pillow

## 📋 Requisitos previos

- Python 3.8+
- MySQL 8.0
- Cuenta de AWS con acceso a S3
- Docker (opcional, para desarrollo local)

## ⚙️ Configuración

### 1. Clonar el repositorio y configurar el entorno

```bash
git clone <your-repo>
cd bodapitisapp
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

**Variables obligatorias para S3:**
- `AWS_ACCESS_KEY_ID`: Tu access key de AWS
- `AWS_SECRET_ACCESS_KEY`: Tu secret key de AWS  
- `AWS_STORAGE_BUCKET_NAME`: Nombre de tu bucket S3
- `AWS_S3_REGION_NAME`: Región de tu bucket (ej: us-east-1)

### 3. Configurar AWS S3

1. **Crear un bucket S3:**
   ```bash
   aws s3 mb s3://your-bucket-name --region us-east-1
   ```

2. **Configurar CORS en el bucket** (si planeas tener frontend):
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": []
     }
   ]
   ```

3. **Política del bucket** (permite acceso público de lectura):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```

### 4. Configurar la base de datos

**Con Docker:**
```bash
docker-compose up -d db
```

**Sin Docker:**
- Instala MySQL 8.0
- Crea la base de datos `bodapitisapp`
- Crea el usuario `django` con permisos

### 5. Ejecutar migraciones

```bash
cd project
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser  # Para acceso al admin
```

### 6. Ejecutar el servidor

```bash
python manage.py runserver
```

## 📚 API Endpoints

### Subir archivo
```
POST /api/media/
Content-Type: multipart/form-data
Body: file=<archivo>
```

### Listar archivos
```
GET /api/media/
GET /api/media/?type=image  # Solo imágenes
GET /api/media/?type=video  # Solo videos
```

### Galería completa
```
GET /api/media/gallery/
```

### Estadísticas
```
GET /api/media/stats/
```

### Detalle de archivo
```
GET /api/media/{id}/
```

## 🔧 Configuración de producción

### Variables adicionales para producción:

```env
DEBUG=False
SECRET_KEY=your-super-secret-key
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Seguridad HTTPS
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True
```

### CloudFront (opcional, recomendado):

Para mejor rendimiento, configura CloudFront delante de tu bucket S3:

```env
AWS_CLOUDFRONT_DOMAIN=your-distribution.cloudfront.net
```

## 🛡️ Moderación

Accede al panel de administración en `/admin/` para:
- Ver todos los archivos subidos
- Marcar archivos como ocultos/visibles
- Ver metadatos y estadísticas
- Gestionar contenido inapropiado

## 🏗️ Estructura del proyecto

```
bodapitisapp/
├── project/
│   ├── project/           # Configuración principal
│   │   ├── settings.py    # Configuración S3 y Django
│   │   └── urls.py        # URLs principales
│   └── wedding_gallery/   # App principal
│       ├── models.py      # Modelo Media
│       ├── views.py       # ViewSets de la API
│       ├── serializers.py # Serializers REST
│       ├── admin.py       # Panel de administración
│       └── urls.py        # URLs de la API
├── requirements.txt       # Dependencias
├── .env.example          # Plantilla de configuración
└── docker-compose.yml    # Configuración Docker
```

## 🎯 Uso de la API

### Ejemplo con cURL:

```bash
# Subir una imagen
curl -X POST http://localhost:8000/api/media/ \
  -F "file=@wedding_photo.jpg"

# Listar archivos
curl http://localhost:8000/api/media/

# Ver galería completa
curl http://localhost:8000/api/media/gallery/
```

### Respuesta ejemplo:

```json
{
  "id": 1,
  "object_key": "images/wedding_photo.jpg",
  "file_url": "https://your-bucket.s3.amazonaws.com/images/wedding_photo.jpg",
  "mime_type": "image/jpeg",
  "media_type": "image",
  "width": 1920,
  "height": 1080,
  "bytes": 245760,
  "created_at": "2025-09-14T14:30:00Z"
}
```

## 💡 Próximos pasos sugeridos

1. **Frontend**: Crear una interfaz web bonita para la galería
2. **Optimización**: Implementar thumbnails automáticos
3. **Notificaciones**: Sistema de notificaciones cuando se suben archivos
4. **Geolocalización**: Añadir metadatos de ubicación a las fotos
5. **Álbumes**: Organizar fotos por momentos/eventos de la boda

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Haz commit de tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT.
