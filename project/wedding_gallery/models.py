import hashlib
import mimetypes
from django.db import models

def get_upload_path(instance, filename):
    """Ruta de subida según el tipo de archivo."""
    ext = filename.split('.')[-1].lower()
    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        return f'images/{filename}'
    elif ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']:
        return f'videos/{filename}'
    return f'other/{filename}'


class Media(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
    ]

    STATUS_CHOICES = [
        (0, 'Oculto'),
        (1, 'Visible'),
    ]

    # --- Campos principales ---
    object_key = models.CharField(
        max_length=512,
        unique=True,
        null=True,          # evita choque por '' en el primer insert
        blank=True,
        help_text="Ruta del archivo en el almacenamiento (p.ej. images/archivo.jpg)"
    )
    file = models.FileField(
        upload_to=get_upload_path,
        help_text="Archivo multimedia subido"
    )
    mime_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Tipo MIME del archivo (ej: image/jpeg, video/mp4)"
    )
    media_type = models.CharField(
        max_length=10,
        choices=MEDIA_TYPE_CHOICES,
        blank=True,
        help_text="Tipo de media: imagen o video"
    )

    # --- Metadatos opcionales ---
    bytes = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Tamaño del archivo en bytes"
    )
    width = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Ancho en píxeles (solo imágenes)"
    )
    height = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Alto en píxeles (solo imágenes)"
    )
    duration_ms = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Duración en milisegundos (solo videos)"
    )

    # --- Control y moderación ---
    status = models.PositiveSmallIntegerField(
        choices=STATUS_CHOICES,
        default=1,
        help_text="1=visible, 0=oculto"
    )

    # --- Timestamps ---
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Fecha y hora de creación"
    )

    # Hash para deduplicación (opcional)
    sha256 = models.BinaryField(
        max_length=32,
        null=True, blank=True,
        help_text="Hash SHA256 del archivo para deduplicación"
    )

    class Meta:
        db_table = 'media'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at'], name='idx_created_at'),
            models.Index(fields=['media_type', 'created_at'], name='idx_type_created'),
        ]
        verbose_name = "Media"
        verbose_name_plural = "Media Files"

    def __str__(self):
        mt = (self.media_type or 'media').title()
        ok = self.object_key or '(sin clave)'
        return f"{mt}: {ok}"

    # ----------------- Helpers internos -----------------
    def _calculate_hash(self):
        self.file.seek(0)
        file_hash = hashlib.sha256()
        for chunk in iter(lambda: self.file.read(4096), b""):
            file_hash.update(chunk)
        self.file.seek(0)
        return file_hash.digest()

    def _calculate_image_metadata(self):
        # TO DO: implementar si quieres extraer width/height aquí
        pass

    def _calculate_video_metadata(self):
        # TO DO: implementar si quieres extraer duración aquí
        pass

    # ----------------- Save override -----------------
    def save(self, *args, **kwargs):
        """
        Calcula metadatos y, sobre todo, fija object_key ANTES del primer insert.
        Así evitamos insertar con '' y romper el índice único.
        """
        if self.file:
            # 1) Asegura object_key antes del INSERT
            if not self.object_key:
                # Normalmente ya viene como 'images/archivo.jpg' por upload_to
                self.object_key = self.file.name or None

            # 2) Metadatos básicos
            self.sha256 = self._calculate_hash()
            self.bytes = getattr(self.file, 'size', None)

            self.mime_type, _ = mimetypes.guess_type(self.file.name)
            if self.mime_type:
                if self.mime_type.startswith('image'):
                    self.media_type = 'image'
                elif self.mime_type.startswith('video'):
                    self.media_type = 'video'

            # 3) Metadatos de imagen/vídeo si quieres
            if self.media_type == 'image':
                self._calculate_image_metadata()
            elif self.media_type == 'video':
                self._calculate_video_metadata()

        # INSERT/UPDATE ya con object_key no vacío
        super().save(*args, **kwargs)

        # Log útil
        try:
            print(f"✅ Archivo guardado: {self.file.url}")
        except Exception:
            pass
        print(f"📁 Object key: {self.object_key}")
