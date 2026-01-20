#!/usr/bin/env python
import os
import django
from django.conf import settings
from django.core.files.base import ContentFile

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

print("\n=== CONFIGURACIÓN S3 ===")
print(f"USE_S3: {getattr(settings, 'USE_S3', 'NO DEFINIDO')}")
print(f"DEFAULT_FILE_STORAGE: {getattr(settings, 'DEFAULT_FILE_STORAGE', 'NO DEFINIDO')}")
print(f"AWS_STORAGE_BUCKET_NAME: {getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'NO DEFINIDO')}")
print(f"AWS_S3_REGION_NAME: {getattr(settings, 'AWS_S3_REGION_NAME', 'NO DEFINIDO')}")
print(f"MEDIA_URL: {getattr(settings, 'MEDIA_URL', 'NO DEFINIDO')}")

print("\n=== TEST CONEXIÓN S3 ===")
try:
    import boto3
    from botocore.exceptions import ClientError
    
    # Crear cliente S3
    s3_client = boto3.client(
        's3',
        aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
        aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1')
    )
    
    # Test conexión listando bucket
    bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
    response = s3_client.list_objects_v2(Bucket=bucket_name, MaxKeys=5)
    
    print(f"✅ Conexión S3 exitosa")
    print(f"📁 Bucket: {bucket_name}")
    
    if 'Contents' in response:
        print(f"📄 Archivos encontrados: {len(response['Contents'])}")
        for obj in response['Contents']:
            print(f"   - {obj['Key']} ({obj['Size']} bytes)")
    else:
        print("📄 Bucket vacío")
    
    # Test permisos de escritura
    print("\n=== TEST PERMISOS ESCRITURA ===")
    try:
        test_key = "test-permissions.txt"
        test_content = b"Test de permisos"
        
        s3_client.put_object(
            Bucket=bucket_name,
            Key=test_key,
            Body=test_content
        )
        print("✅ Permisos de escritura OK")
        
        # Limpiar archivo de prueba
        s3_client.delete_object(Bucket=bucket_name, Key=test_key)
        print("✅ Archivo de prueba eliminado")
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        print(f"❌ Error de permisos: {error_code}")
        print(f"   Detalle: {e.response['Error']['Message']}")
        
except Exception as e:
    print(f"❌ Error conectando a S3: {e}")

print("\n=== ARCHIVOS EN BD ===")
from wedding_gallery.models import Media
media_count = Media.objects.count()
print(f"📊 Total archivos en BD: {media_count}")

if media_count > 0:
    latest = Media.objects.first()
    print(f"📄 Último archivo: {latest.file.name}")
    print(f"🔗 URL: {latest.file.url}")
    
    # Test si el archivo existe físicamente
    print(f"\n=== TEST STORAGE BACKEND ===")
    try:
        from django.core.files.storage import default_storage
        print(f"🔧 Storage class: {default_storage.__class__}")
        
        # Verificar si el archivo existe en el storage
        file_exists = default_storage.exists(latest.file.name)
        print(f"📁 Archivo existe en storage: {file_exists}")
        
        if file_exists:
            file_size = default_storage.size(latest.file.name)
            print(f"📏 Tamaño en storage: {file_size} bytes")
        
        # Test directo de subida con default_storage
        test_content = b"Test storage upload"
        test_path = "test-storage.txt"
        
        saved_path = default_storage.save(test_path, ContentFile(test_content))
        print(f"✅ Test storage upload: {saved_path}")
        
        # Verificar que se subió
        if default_storage.exists(saved_path):
            print("✅ Archivo test encontrado en storage")
            default_storage.delete(saved_path)
            print("✅ Archivo test eliminado")
        
    except Exception as e:
        print(f"❌ Error en storage backend: {e}")
        import traceback
        traceback.print_exc()
