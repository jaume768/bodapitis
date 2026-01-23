from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from drf_spectacular.openapi import AutoSchema
from .models import Media
from .serializers import MediaSerializer, MediaListSerializer
import requests
from urllib.parse import unquote


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
    
    @extend_schema(
        tags=['media'],
        summary='Descargar archivo (proxy)',
        description='Descarga un archivo desde S3 a través del servidor, evitando problemas de CORS en móviles',
        parameters=[
            OpenApiParameter(
                name='url',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='URL completa del archivo a descargar',
                required=True
            ),
        ]
    )
    @action(detail=False, methods=['get'])
    def download_proxy(self, request):
        """
        Endpoint proxy para descargar archivos desde S3.
        Soluciona problemas de CORS en navegadores móviles.
        """
        file_url = request.query_params.get('url', None)
        
        if not file_url:
            return Response(
                {'error': 'Se requiere el parámetro "url"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Fetch el archivo desde S3
            response = requests.get(file_url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Obtener el tipo de contenido
            content_type = response.headers.get('Content-Type', 'application/octet-stream')
            
            # Extraer nombre de archivo de la URL
            filename = file_url.split('/')[-1]
            filename = unquote(filename)  # Decodificar URL encoding
            
            # Crear respuesta streaming
            django_response = StreamingHttpResponse(
                response.iter_content(chunk_size=8192),
                content_type=content_type
            )
            django_response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            # Copiar headers útiles
            if 'Content-Length' in response.headers:
                django_response['Content-Length'] = response.headers['Content-Length']
            
            return django_response
            
        except requests.RequestException as e:
            return Response(
                {'error': f'Error al descargar el archivo: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            return Response(
                {'error': f'Error interno: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
