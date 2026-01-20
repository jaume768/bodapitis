from pathlib import Path
from decouple import config
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Seguridad / Debug ---
SECRET_KEY = config(
    'SECRET_KEY',
    default='django-insecure-t(-8qz!=uc-n$u#+_s6mu-%apga*(jmv8!@nhew1h3&&m#4e#c'
)
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

# --- Apps ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Terceros
    'rest_framework',
    'drf_spectacular',  # Documentación OpenAPI
    'storages',  # necesario para S3
    # 'corsheaders',  # si lo necesitas, descomenta y añade el middleware
    # Local
    'wedding_gallery',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # 'corsheaders.middleware.CorsMiddleware',  # si usas CORS
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'project.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'project.wsgi.application'

# --- Base de datos ---
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME', default='bodapitisapp'),
        'USER': config('DB_USER', default='django'),
        'PASSWORD': config('DB_PASSWORD', default='secret'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='3306'),
    }
}

# --- Passwords ---
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --- I18N / TZ ---
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# --- Static ---
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- DRF ---
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# =========================
#   ARCHIVOS / ALMACENES
#   (Django 5+ con STORAGES)
# =========================
USE_S3 = config('USE_S3', default=False, cast=bool)

if USE_S3:
    # Credenciales / bucket
    AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='eu-west-3')
    AWS_S3_CUSTOM_DOMAIN = config(
        'AWS_S3_CUSTOM_DOMAIN',
        default=f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
    )

    # Parámetros S3
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = config('AWS_S3_FILE_OVERWRITE', default=False, cast=bool)
    AWS_QUERYSTRING_AUTH = config('AWS_QUERYSTRING_AUTH', default=False, cast=bool)

    # ✅ Django 5: define los storages aquí
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            # Si necesitas distintas ubicaciones, puedes añadir "OPTIONS": {"location": "media/"},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

    # Media
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
else:
    # Storage local de desarrollo
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# --- Subidas grandes (opcional) ---
FILE_UPLOAD_MAX_MEMORY_SIZE = 2**31 - 1
DATA_UPLOAD_MAX_MEMORY_SIZE = 2**31 - 1
FILE_UPLOAD_TEMP_DIR = None

# --- Seguridad varias ---
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin-allow-popups'

# --- CORS (si lo usas) ---
# CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='').split(',')
# CORS_ALLOW_ALL_ORIGINS = DEBUG

# --- API DOCUMENTATION (drf-spectacular) ---
SPECTACULAR_SETTINGS = {
    'TITLE': 'Wedding Gallery API',
    'DESCRIPTION': 'API para la galería de fotos y videos de bodas con soporte para subida a S3',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/',
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True,
    },
    'TAGS': [
        {'name': 'media', 'description': 'Operaciones con archivos multimedia'},
        {'name': 'gallery', 'description': 'Endpoints de galería'},
        {'name': 'stats', 'description': 'Estadísticas del sistema'},
    ],
}
