# 🚀 Guía de Despliegue a AWS - Wedding Gallery

## 📋 Tabla de Contenidos
1. [Requisitos Previos](#requisitos-previos)
2. [Configuración Inicial](#configuración-inicial)
3. [Preparación del Proyecto](#preparación-del-proyecto)
4. [Despliegue en AWS EC2](#despliegue-en-aws-ec2)
5. [Configuración del Dominio](#configuración-del-dominio)
6. [SSL con Caddy](#ssl-con-caddy)
7. [Verificación y Monitoreo](#verificación-y-monitoreo)
8. [Mantenimiento](#mantenimiento)

---

## ✅ Requisitos Previos

### Herramientas Necesarias
- [ ] Cuenta de AWS activa
- [ ] Dominio comprado (Namecheap, GoDaddy, AWS Route 53, etc.)
- [ ] Git instalado localmente
- [ ] SSH client instalado

### Conocimientos Básicos
- Comandos básicos de Linux
- Docker y Docker Compose
- Git básico

---

## 🔧 Configuración Inicial

### 1. Configurar Variables de Entorno

```bash
# En tu máquina local
cp .env.production.example .env.production
```

**Edita `.env.production` con tus valores:**
```bash
# Generar SECRET_KEY
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Pegar el resultado en SECRET_KEY
SECRET_KEY=tu_secret_key_generado

# Configurar dominio
DOMAIN=tudominio.com
ALLOWED_HOSTS=tudominio.com,www.tudominio.com

# Base de datos (contraseña fuerte)
DB_PASSWORD=TuPasswordSeguro123!

# AWS S3 (obtener de AWS Console)
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_STORAGE_BUCKET_NAME=nombre-bucket
AWS_S3_REGION_NAME=us-east-1

# Admin
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=tu@email.com
DJANGO_SUPERUSER_PASSWORD=AdminPassword123!
```

### 2. Actualizar Caddyfile

```bash
# Editar Caddyfile
nano Caddyfile
```

**Reemplazar:**
- `tudominio.com` → tu dominio real
- `tu@email.com` → tu email (para certificados SSL)

---

## 📦 Preparación del Proyecto

### 1. Commit y Push a Git

```bash
# Inicializar repo si no existe
git init
git add .
git commit -m "Preparar para producción"

# Crear repo en GitHub/GitLab y push
git remote add origin https://github.com/tu-usuario/wedding-gallery.git
git push -u origin main
```

### 2. Verificar `.gitignore`

Asegúrate de que `.env.production` está en `.gitignore`:
```bash
echo ".env.production" >> .gitignore
echo "*.log" >> .gitignore
git add .gitignore
git commit -m "Actualizar .gitignore"
```

---

## ☁️ Despliegue en AWS EC2

### PASO 1: Crear Instancia EC2

1. **Ir a AWS Console → EC2 → Launch Instance**

2. **Configuración:**
   - **Nombre:** `wedding-gallery-prod`
   - **AMI:** Ubuntu Server 22.04 LTS (64-bit x86)
   - **Tipo de instancia:** `t3.small` o `t3.medium` (recomendado para producción)
   - **Par de claves:** Crear nuevo par → Descargar `.pem`
   - **Configuración de red:**
     - ✅ Permitir tráfico HTTPS (puerto 443)
     - ✅ Permitir tráfico HTTP (puerto 80)
     - ✅ Permitir SSH (puerto 22) - solo desde tu IP
   - **Almacenamiento:** 20-30 GB gp3

3. **Lanzar instancia**

### PASO 2: Conectar a EC2

```bash
# Dar permisos al archivo .pem
chmod 400 ~/Downloads/tu-clave.pem

# Conectar vía SSH
ssh -i ~/Downloads/tu-clave.pem ubuntu@tu-ip-publica-ec2
```

### PASO 3: Instalar Docker en EC2

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Añadir usuario al grupo docker
sudo usermod -aG docker ubuntu

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Verificar instalación
docker --version
docker compose version

# Reiniciar sesión para aplicar cambios de grupo
exit
# Volver a conectar por SSH
```

### PASO 4: Clonar Proyecto en EC2

```bash
# Instalar git
sudo apt install git -y

# Clonar repositorio
git clone https://github.com/tu-usuario/wedding-gallery.git
cd wedding-gallery
```

### PASO 5: Configurar Variables de Entorno en EC2

```bash
# Crear archivo .env.production
nano .env.production

# Pegar el contenido de tu .env.production local
# Guardar: Ctrl+O, Enter, Ctrl+X
```

### PASO 6: Construir y Lanzar Contenedores

```bash
# Construir imágenes
docker compose -f docker-compose.prod.yml build

# Iniciar servicios
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Verificar que todo está corriendo
docker compose -f docker-compose.prod.yml ps
```

**Deberías ver:**
- ✅ `wedding_gallery_db_prod` - healthy
- ✅ `wedding_gallery_web_prod` - healthy
- ✅ `wedding_gallery_caddy` - running

---

## 🌐 Configuración del Dominio

### Opción A: Route 53 (AWS)

1. **Ir a Route 53 → Hosted Zones → Create hosted zone**
2. **Dominio:** `tudominio.com`
3. **Crear registros:**
   ```
   Tipo: A
   Nombre: @ (o tudominio.com)
   Valor: IP-PUBLICA-DE-TU-EC2
   TTL: 300
   
   Tipo: A
   Nombre: www
   Valor: IP-PUBLICA-DE-TU-EC2
   TTL: 300
   ```

4. **Copiar nameservers** y configurarlos en tu registrador de dominio

### Opción B: Otro Registrador (Namecheap, GoDaddy, etc.)

1. **Ir al panel de tu registrador**
2. **Gestión DNS de tu dominio**
3. **Añadir registros A:**
   ```
   Host: @
   Value: IP-PUBLICA-DE-TU-EC2
   TTL: Automatic
   
   Host: www
   Value: IP-PUBLICA-DE-TU-EC2
   TTL: Automatic
   ```

4. **Esperar propagación DNS** (5-30 minutos)

### Verificar DNS

```bash
# Comprobar que apunta a tu EC2
nslookup tudominio.com
dig tudominio.com

# Debería mostrar la IP de tu EC2
```

---

## 🔒 SSL con Caddy (Automático)

**¡Caddy se encarga automáticamente!**

1. **Esperar 1-2 minutos** después de que el DNS esté propagado
2. **Caddy obtendrá certificado SSL de Let's Encrypt automáticamente**
3. **Verificar:**

```bash
# Ver logs de Caddy
docker logs wedding_gallery_caddy

# Deberías ver algo como:
# "certificate obtained successfully"
```

### Forzar Renovación Manual (si es necesario)

```bash
docker exec wedding_gallery_caddy caddy reload --config /etc/caddy/Caddyfile
```

### Verificar SSL

- Visita: `https://tudominio.com`
- Debería mostrar candado verde 🔒
- Verificar en: https://www.ssllabs.com/ssltest/

---

## ✅ Verificación y Monitoreo

### 1. Verificar Aplicación

```bash
# Health check
curl https://tudominio.com/api/health/

# Respuesta esperada:
# {"status":"healthy","service":"wedding_gallery"}
```

### 2. Acceder a Admin

1. Ir a: `https://tudominio.com/admin/`
2. Usuario: valor de `DJANGO_SUPERUSER_USERNAME`
3. Contraseña: valor de `DJANGO_SUPERUSER_PASSWORD`

### 3. Probar Upload

1. Ir a: `https://tudominio.com/`
2. Subir una foto/video
3. Verificar que aparece en álbum

### 4. Verificar S3

```bash
# En EC2, verificar logs
docker compose -f docker-compose.prod.yml logs web | grep -i s3
```

---

## 🔧 Mantenimiento

### Ver Logs

```bash
# Todos los servicios
docker compose -f docker-compose.prod.yml logs -f

# Solo Django
docker compose -f docker-compose.prod.yml logs -f web

# Solo Caddy
docker compose -f docker-compose.prod.yml logs -f caddy

# Solo BD
docker compose -f docker-compose.prod.yml logs -f db
```

### Actualizar Código

```bash
# SSH a EC2
cd wedding-gallery

# Pull cambios
git pull origin main

# Rebuild y restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Backups de Base de Datos

```bash
# Crear backup
docker exec wedding_gallery_db_prod mysqldump \
  -u root -p${DB_PASSWORD} wedding_gallery > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i wedding_gallery_db_prod mysql \
  -u root -p${DB_PASSWORD} wedding_gallery < backup_20260120.sql
```

### Limpiar Recursos

```bash
# Eliminar imágenes no usadas
docker image prune -a

# Eliminar volúmenes no usados
docker volume prune

# Ver uso de disco
df -h
docker system df
```

---

## 🆘 Troubleshooting

### Problema: SSL no se genera

```bash
# Verificar DNS apunta a EC2
nslookup tudominio.com

# Verificar puerto 80/443 abiertos
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Reiniciar Caddy
docker restart wedding_gallery_caddy
```

### Problema: Error 502 Bad Gateway

```bash
# Verificar que Django está corriendo
docker compose -f docker-compose.prod.yml ps

# Ver logs de web
docker compose -f docker-compose.prod.yml logs web

# Reiniciar web
docker restart wedding_gallery_web_prod
```

### Problema: Base de datos no conecta

```bash
# Verificar BD
docker exec -it wedding_gallery_db_prod mysql -u root -p

# Ver logs
docker logs wedding_gallery_db_prod
```

---

## 💰 Costos Estimados AWS

**Mensual (aprox):**
- EC2 t3.small: ~$15-20/mes
- S3 (100GB): ~$2-3/mes
- Transferencia datos: ~$5-10/mes
- Route 53 (opcional): $0.50/mes

**Total: ~$22-35/mes**

---

## 📚 Recursos Adicionales

- [Documentación de Caddy](https://caddyserver.com/docs/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/)
- [AWS EC2 Guide](https://docs.aws.amazon.com/ec2/)
- [Docker Compose Production](https://docs.docker.com/compose/production/)

---

## ✨ Resumen de Comandos Útiles

```bash
# Ver estado
docker compose -f docker-compose.prod.yml ps

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Reiniciar todo
docker compose -f docker-compose.prod.yml restart

# Detener todo
docker compose -f docker-compose.prod.yml down

# Iniciar todo
docker compose -f docker-compose.prod.yml up -d

# Ejecutar comando en Django
docker exec -it wedding_gallery_web_prod python manage.py <comando>

# Shell de Django
docker exec -it wedding_gallery_web_prod python manage.py shell

# Crear superusuario manualmente
docker exec -it wedding_gallery_web_prod python manage.py createsuperuser
```

---

¡Felicidades! 🎉 Tu aplicación está en producción con SSL automático.
