import mimetypes
from rest_framework import serializers
from PIL import Image
from io import BytesIO

from .models import Media


class MediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = [
            'id', 'object_key', 'file', 'file_url', 'mime_type', 'media_type',
            'bytes', 'width', 'height', 'duration_ms', 'status', 'created_at'
        ]
        read_only_fields = [
            'id', 'object_key', 'file_url', 'bytes', 'width',
            'height', 'duration_ms', 'created_at', 'sha256'
        ]

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def validate_file(self, value):
        mime_type, _ = mimetypes.guess_type(value.name)
        if not mime_type:
            raise serializers.ValidationError("Tipo de archivo no reconocido")

        allowed_image = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        allowed_video = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']

        if mime_type not in allowed_image + allowed_video:
            raise serializers.ValidationError(
                "Tipo de archivo no permitido. Solo imágenes (JPEG, PNG, GIF, WebP) y vídeos (MP4, MOV, AVI, WebM)"
            )
        return value

    def create(self, validated_data):
        file = validated_data['file']

        mime_type, _ = mimetypes.guess_type(file.name)
        validated_data['mime_type'] = mime_type or 'application/octet-stream'
        if mime_type and mime_type.startswith('image/'):
            validated_data['media_type'] = 'image'
        elif mime_type and mime_type.startswith('video/'):
            validated_data['media_type'] = 'video'

        instance = super().create(validated_data)

        # Extraer metadatos sin usar .path (compatible con S3)
        if instance.media_type == 'image':
            try:
                # Asegura que leemos desde el principio del stream
                instance.file.seek(0)
                with Image.open(BytesIO(instance.file.read())) as img:
                    instance.width, instance.height = img.width, img.height
                # Guarda solo los campos cambiados
                instance.save(update_fields=['width', 'height'])
            except Exception:
                pass

        return instance


class MediaListSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = ['id', 'file_url', 'media_type', 'width', 'height', 'created_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None
