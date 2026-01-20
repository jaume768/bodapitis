from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MediaViewSet, health_check

# Create router and register viewsets
router = DefaultRouter()
router.register(r'media', MediaViewSet, basename='media')

app_name = 'wedding_gallery'

urlpatterns = [
    path('health/', health_check, name='health'),
    path('', include(router.urls)),
]
