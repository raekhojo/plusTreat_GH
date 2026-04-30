"""
URL configuration for plus project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("", lambda request: redirect("swagger-ui")),
    path("admin/", admin.site.urls),
    path("swagger.json", SpectacularAPIView.as_view(), name="swagger-json"),
    path("swagger.json/", SpectacularAPIView.as_view(), name="swagger-json-slash"),
    path("swagger/", SpectacularSwaggerView.as_view(url_name="swagger-json"), name="swagger-ui"),
    path("api/", include("customers.urls")),
    path("api/", include("products.urls")),
    path("api/", include("staffing.urls")),
    path("api/", include("invoices.urls")),
    path("api/", include("operations.urls")),
]
