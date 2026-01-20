from django.contrib import admin
from django.utils.html import format_html
from .models import Media


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ['id', 'media_type', 'file_preview', 'object_key', 'status', 'bytes_formatted', 'created_at']
    list_filter = ['media_type', 'status', 'created_at']
    search_fields = ['object_key', 'mime_type']
    readonly_fields = ['object_key', 'bytes', 'width', 'height', 'duration_ms', 'sha256', 'created_at', 'file_preview']
    list_editable = ['status']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Archivo', {
            'fields': ('file', 'file_preview', 'object_key')
        }),
        ('Metadatos', {
            'fields': ('media_type', 'mime_type', 'bytes', 'width', 'height', 'duration_ms')
        }),
        ('Control', {
            'fields': ('status', 'created_at')
        }),
        ('Deduplicación', {
            'fields': ('sha256',),
            'classes': ('collapse',)
        }),
    )
    
    def file_preview(self, obj):
        """Show preview of the media file"""
        if obj.file:
            if obj.media_type == 'image':
                return format_html(
                    '<img src="{}" style="max-width: 100px; max-height: 100px;" />',
                    obj.file.url
                )
            elif obj.media_type == 'video':
                return format_html(
                    '<video width="100" height="75" controls><source src="{}" type="{}"></video>',
                    obj.file.url,
                    obj.mime_type
                )
        return "No preview available"
    file_preview.short_description = "Preview"
    
    def bytes_formatted(self, obj):
        """Format bytes in human readable format"""
        if obj.bytes:
            bytes_val = obj.bytes
            if bytes_val < 1024:
                return f"{bytes_val} B"
            elif bytes_val < 1024 * 1024:
                return f"{bytes_val / 1024:.1f} KB"
            else:
                return f"{bytes_val / (1024 * 1024):.1f} MB"
        return "Unknown"
    bytes_formatted.short_description = "Size"
    
    actions = ['mark_as_visible', 'mark_as_hidden']
    
    def mark_as_visible(self, request, queryset):
        """Mark selected media as visible"""
        updated = queryset.update(status=1)
        self.message_user(request, f'{updated} archivos marcados como visibles.')
    mark_as_visible.short_description = "Marcar como visible"
    
    def mark_as_hidden(self, request, queryset):
        """Mark selected media as hidden"""
        updated = queryset.update(status=0)
        self.message_user(request, f'{updated} archivos marcados como ocultos.')
    mark_as_hidden.short_description = "Marcar como oculto"
