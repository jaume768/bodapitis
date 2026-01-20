#!/bin/bash
set -e

echo "=== Wedding Gallery - Production Entrypoint ==="

# Esperar a que la base de datos esté lista
echo "Esperando MySQL..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done
echo "✓ MySQL conectado"

# Aplicar migraciones
echo "Aplicando migraciones..."
python manage.py migrate --noinput

# Recolectar archivos estáticos
echo "Recolectando archivos estáticos..."
python manage.py collectstatic --noinput --clear

# Crear superusuario si no existe (solo si están las variables)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "Verificando superusuario..."
    python manage.py shell << END
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$DJANGO_SUPERUSER_USERNAME').exists():
    User.objects.create_superuser('$DJANGO_SUPERUSER_USERNAME', '$DJANGO_SUPERUSER_EMAIL', '$DJANGO_SUPERUSER_PASSWORD')
    print('✓ Superusuario creado')
else:
    print('✓ Superusuario ya existe')
END
fi

echo "=== Iniciando aplicación ==="
exec "$@"
