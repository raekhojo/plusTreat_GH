from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountTransactionViewSet,
    DashboardOverviewView,
    PricingRuleViewSet,
    ProductionBatchViewSet,
    PurchasePaymentViewSet,
    PurchaseViewSet,
    RawMaterialViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register(r"suppliers", SupplierViewSet, basename="supplier")
router.register(r"raw-materials", RawMaterialViewSet, basename="raw-material")
router.register(r"purchases", PurchaseViewSet, basename="purchase")
router.register(r"purchase-payments", PurchasePaymentViewSet, basename="purchase-payment")
router.register(r"production-batches", ProductionBatchViewSet, basename="production-batch")
router.register(r"account-transactions", AccountTransactionViewSet, basename="account-transaction")
router.register(r"pricing-rules", PricingRuleViewSet, basename="pricing-rule")

urlpatterns = [
    path("dashboard-overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    *router.urls,
]
