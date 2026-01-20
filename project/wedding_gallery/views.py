from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q
from django.http import JsonResponse
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from drf_spectacular.openapi import AutoSchema
from .models import Media
from .serializers import MediaSerializer, MediaListSerializer


# Health check endpoint para monitoreo
@api_view(['GET'])
def health_check(request):
    """Endpoint simple para verificar que la aplicación está funcionando"""
    return JsonResponse({'status': 'healthy', 'service': 'wedding_gallery'})


@extend_schema_view(
    list=extend_schema(
        tags=['media'],
        summary='Listar archivos multimedia',
        description='Obtiene una lista paginada de archivos multimedia (imágenes y videos) visibles',
        parameters=[
            OpenApiParameter(
                name='type',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Filtrar por tipo de media: "image" o "video"',
                enum=['image', 'video']
            ),
        ]
    ),
    create=extend_schema(
        tags=['media'],
        summary='Subir archivo multimedia',
        description='Sube un nuevo archivo multimedia (imagen o video) al sistema'
    ),
    retrieve=extend_schema(
        tags=['media'],
        summary='Obtener archivo específico',
        description='Obtiene los detalles de un archivo multimedia específico'
    ),
    update=extend_schema(
        tags=['media'],
        summary='Actualizar archivo',
        description='Actualiza los metadatos de un archivo multimedia'
    ),
    partial_update=extend_schema(
        tags=['media'],
        summary='Actualización parcial',
        description='Actualiza parcialmente los metadatos de un archivo multimedia'
    ),
    destroy=extend_schema(
        tags=['media'],
        summary='Eliminar archivo',
        description='Marca un archivo multimedia como eliminado (soft delete)'
    )
)
class MediaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para manejar la subida y visualización de archivos multimedia.
    No requiere autenticación - cualquiera puede subir y ver archivos.
    """
    queryset = Media.objects.filter(status=1).order_by('-created_at')
    serializer_class = MediaSerializer
    parser_classes = (MultiPartParser, FormParser)
    
    def get_serializer_class(self):
        """Use different serializers for list vs detail views"""
        if self.action == 'list':
            return MediaListSerializer
        return MediaSerializer
    
    def list(self, request, *args, **kwargs):
        """List all visible media files"""
        queryset = self.filter_queryset(self.get_queryset())
        
        # Filter by media type if requested
        media_type = request.query_params.get('type', None)
        if media_type in ['image', 'video']:
            queryset = queryset.filter(media_type=media_type)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        """Upload a new media file"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            media = serializer.save()
            return Response(
                MediaSerializer(media, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response(
                {'error': f'Error al subir el archivo: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @extend_schema(
        tags=['gallery'],
        summary='Galería completa',
        description='Obtiene la galería completa separada por tipos (imágenes y videos) con contador total',
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'images': {'type': 'array', 'description': 'Lista de imágenes'},
                    'videos': {'type': 'array', 'description': 'Lista de videos'},
                    'total_count': {'type': 'integer', 'description': 'Número total de archivos'}
                }
            }
        }
    )
    @action(detail=False, methods=['get'])
    def gallery(self, request):
        """
        Endpoint especial para obtener la galería completa optimizada
        """
        images = Media.objects.filter(status=1, media_type='image').order_by('-created_at')
        videos = Media.objects.filter(status=1, media_type='video').order_by('-created_at')
        
        return Response({
            'images': MediaListSerializer(images, many=True, context={'request': request}).data,
            'videos': MediaListSerializer(videos, many=True, context={'request': request}).data,
            'total_count': images.count() + videos.count()
        })
    
    @extend_schema(
        tags=['stats'],
        summary='Estadísticas de la galería',
        description='Obtiene estadísticas básicas del sistema: total de archivos, imágenes y videos',
        responses={
            200: {
                'type': 'object',
                'properties': {
                    'total_files': {'type': 'integer', 'description': 'Número total de archivos'},
                    'total_images': {'type': 'integer', 'description': 'Número total de imágenes'},
                    'total_videos': {'type': 'integer', 'description': 'Número total de videos'}
                }
            }
        }
    )
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Obtener estadísticas básicas de la galería
        """
        total_media = Media.objects.filter(status=1).count()
        total_images = Media.objects.filter(status=1, media_type='image').count()
        total_videos = Media.objects.filter(status=1, media_type='video').count()
        
        return Response({
            'total_files': total_media,
            'total_images': total_images,
            'total_videos': total_videos
        })
