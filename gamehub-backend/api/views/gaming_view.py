from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from api.models import AuditLog, InventoryItem, ResourceUnit, Session, SessionOrder
from api.pagination import StandardResultsSetPagination
from api.serializers import SessionSerializer
from api.serializers.gaming_serializer import SessionCreateSerializer
from .permissions_view import (
    CanAddSessionOrder,
    CanEndSession,
    CanManageSessions,
    CanPauseOrResumeSession,
    CanPauseSession,
    CanRemoveSessionOrder,
    CanResumeSession,
    CanStartSession,
    IsOwner,
    PermissionByActionMixin,
    is_owner_user,
)


class SessionViewSet(PermissionByActionMixin, viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    permission_classes = [CanManageSessions]
    pagination_class = StandardResultsSetPagination
    permission_action_map = {
        "create": [CanStartSession],
        "pause": [CanPauseSession],
        "resume": [CanResumeSession],
        "toggle_pause": [CanPauseOrResumeSession],
        "end": [CanEndSession],
        "add_order": [CanAddSessionOrder],
        "remove_order": [CanRemoveSessionOrder],
        "list": [CanManageSessions],
        "retrieve": [CanManageSessions],
        "update": [IsOwner],
        "partial_update": [IsOwner],
        "correct": [IsOwner],
        "destroy": [IsOwner],
    }

    def get_queryset(self):
        return Session.objects.all().select_related(
            "resource_unit", "resource_unit__resource_type"
        ).prefetch_related("orders")

    def _audit(self, action_type, resource_name, description, metadata=None):
        AuditLog.objects.create(
            user=self.request.user,
            action_type=action_type,
            resource_type="Session",
            resource_name=resource_name,
            description=description,
            metadata=metadata or {},
        )

    def _parse_positive_quantity(self, value):
        try:
            quantity = int(value)
        except (TypeError, ValueError):
            return None
        return quantity if quantity > 0 else None

    def _parse_money(self, value, field_name):
        try:
            amount = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return None, Response(
                {"error": f"{field_name} must be a valid amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount < 0:
            return None, Response(
                {"error": f"{field_name} cannot be negative."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return amount, None

    def _parse_datetime_value(self, value, field_name):
        parsed = parse_datetime(value or "")
        if not parsed:
            return None, Response(
                {"error": f"{field_name} must be a valid datetime."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed, None

    def _correction_snapshot(self, session):
        return {
            "resource_unit_id": session.resource_unit_id,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "discount": str(session.discount),
            "final_cost": str(session.final_cost) if session.final_cost is not None else None,
            "final_duration_minutes": (
                str(session.final_duration_minutes)
                if session.final_duration_minutes is not None
                else None
            ),
            "orders": [
                {
                    "id": order.id,
                    "inventory_item_id": order.inventory_item_id,
                    "quantity": order.quantity,
                    "unit_price": str(order.unit_price),
                    "unit_cost": str(order.unit_cost),
                }
                for order in session.orders.all()
            ],
        }

    def _recalculate_completed_session(self, session):
        if not session.end_time:
            session.final_cost = None
            session.final_duration_minutes = None
            session.save(update_fields=["final_cost", "final_duration_minutes"])
            return

        active_ms = session.get_active_ms(session.end_time)
        session.final_duration_minutes = Decimal(str(active_ms / 60000)).quantize(
            Decimal("0.01")
        )
        session.final_cost = session.get_live_cost(session.end_time)
        session.save(update_fields=["final_duration_minutes", "final_cost"])

    def _pause_session(self, session):
        if session.end_time:
            return Response(
                {"error": "Cannot pause an ended session."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if session.is_paused:
            return Response(
                {"error": "Session is already paused."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.is_paused = True
        session.last_pause_time = timezone.now()
        session.save(update_fields=["is_paused", "last_pause_time"])
        self._audit(
            AuditLog.ACTION_UPDATE,
            str(session),
            "Paused session.",
            {"session_id": session.id, "resource_unit_id": session.resource_unit_id},
        )
        return Response(self.get_serializer(session).data)

    def _resume_session(self, session):
        if session.end_time:
            return Response(
                {"error": "Cannot resume an ended session."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not session.is_paused:
            return Response(
                {"error": "Session is not paused."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if session.last_pause_time:
            session.total_paused_ms += int(
                (timezone.now() - session.last_pause_time).total_seconds() * 1000
            )
        session.is_paused = False
        session.last_pause_time = None
        session.save(update_fields=["is_paused", "last_pause_time", "total_paused_ms"])
        self._audit(
            AuditLog.ACTION_UPDATE,
            str(session),
            "Resumed session.",
            {
                "session_id": session.id,
                "resource_unit_id": session.resource_unit_id,
                "total_paused_ms": session.total_paused_ms,
            },
        )
        return Response(self.get_serializer(session).data)

    def update(self, request, *args, **kwargs):
        return Response(
            {"error": "Use the session correction endpoint with a reason."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        has_pricing_override = any(
            request.data.get(field) not in (None, "", 0, "0")
            for field in ["pricePerHour", "fixedPrice"]
        )
        if has_pricing_override and not is_owner_user(request.user):
            return Response(
                {"error": "Only owners can override session pricing."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        provided_name = (data.get("name") or "").strip()

        session = Session.objects.create(
            customer_name=provided_name or "__TEMP__",
            resource_unit=data["resource_unit"],
            session_type=data["sessionType"],
            custom_price_per_hour=data.get("pricePerHour"),
            fixed_price=data.get("fixedPrice"),
            prepaid_amount_usd=data.get("prepaid_amount_usd"),
            original_payment_currency=data.get("original_payment_currency", "USD"),
            original_payment_amount=data.get("original_payment_amount"),
            duration_hours=data.get("durationHours"),
            planned_end_time=data.get("planned_end_time"),
            metadata=data.get("metadata") or {},
        )

        if not provided_name:
            session.customer_name = f"Customer #{session.id}"
            session.save(update_fields=["customer_name"])

        self._audit(
            AuditLog.ACTION_CREATE,
            str(session),
            "Started session.",
            {
                "session_id": session.id,
                "resource_unit_id": session.resource_unit_id,
                "session_type": session.session_type,
            },
        )
        return Response(self.get_serializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._pause_session(self.get_object())

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return self._resume_session(self.get_object())

    @action(detail=True, methods=["post"])
    def toggle_pause(self, request, pk=None):
        session = self.get_object()
        if session.is_paused:
            return self._resume_session(session)
        return self._pause_session(session)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def end(self, request, pk=None):
        session = self.get_object()
        discount = request.data.get("discount")
        parsed_discount = Decimal("0.00")

        if discount not in (None, ""):
            try:
                parsed_discount = Decimal(str(discount))
            except (InvalidOperation, ValueError):
                return Response(
                    {"error": "Discount must be a valid amount."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if parsed_discount < 0:
                return Response(
                    {"error": "Discount cannot be negative."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if parsed_discount > 0:
            if not request.user.has_staff_permission("can_apply_discount"):
                return Response(
                    {"error": "You do not have permission to apply discounts."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            session.discount = parsed_discount
            self._audit(
                AuditLog.ACTION_UPDATE,
                str(session),
                "Applied session discount.",
                {"session_id": session.id, "discount": str(parsed_discount)},
            )

        session.end_session()
        self._audit(
            AuditLog.ACTION_UPDATE,
            str(session),
            "Ended session.",
            {
                "session_id": session.id,
                "final_cost": str(session.final_cost),
                "final_duration_minutes": str(session.final_duration_minutes),
            },
        )
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def add_order(self, request, pk=None):
        session = self.get_object()
        if session.end_time:
            return Response(
                {"error": "Cannot add orders to completed sessions."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quantity = self._parse_positive_quantity(request.data.get("quantity", 1))
        if quantity is None:
            return Response(
                {"error": "Quantity must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        inventory_item_id = request.data.get("inventoryItemId")
        item_name = request.data.get("name")
        unit_price = request.data.get("price")
        inventory_item = None

        if inventory_item_id:
            inventory_item = (
                InventoryItem.objects.select_for_update()
                .filter(id=inventory_item_id, is_active=True)
                .first()
            )
            if not inventory_item:
                return Response(
                    {"error": "Inventory item not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if inventory_item.quantity_in_stock < quantity:
                return Response(
                    {"error": f"Insufficient stock for {inventory_item.name}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            inventory_item.quantity_in_stock -= quantity
            inventory_item.save(update_fields=["quantity_in_stock"])
            item_name = inventory_item.name
            unit_price = inventory_item.sale_price
            unit_cost = inventory_item.cost_price
        else:
            if not is_owner_user(request.user):
                return Response(
                    {"error": "Only owners can add custom-priced session orders."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            unit_cost = Decimal("0.00")

        if not item_name or unit_price is None:
            return Response(
                {"error": "Missing item name or price."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            unit_price = Decimal(str(unit_price))
        except (InvalidOperation, ValueError):
            return Response(
                {"error": "Price must be a valid amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if unit_price < 0:
            return Response(
                {"error": "Price cannot be negative."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = SessionOrder.objects.create(
            session=session,
            inventory_item=inventory_item,
            item_name=item_name,
            quantity=quantity,
            unit_price=unit_price,
            unit_cost=unit_cost,
            total_price=Decimal("0.00"),
        )
        self._audit(
            AuditLog.ACTION_CREATE,
            str(session),
            "Added order to session.",
            {
                "session_id": session.id,
                "order_id": order.id,
                "inventory_item_id": inventory_item.id if inventory_item else None,
                "quantity": quantity,
                "unit_price": str(unit_price),
                "stock_after": inventory_item.quantity_in_stock if inventory_item else None,
            },
        )
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def remove_order(self, request, pk=None):
        session = self.get_object()
        if session.end_time:
            return Response(
                {"error": "Cannot remove orders from completed sessions."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order_id = request.data.get("orderId")
        try:
            order = session.orders.get(id=order_id)
        except SessionOrder.DoesNotExist:
            return Response(
                {"error": "Order not found in this session."},
                status=status.HTTP_404_NOT_FOUND,
            )

        stock_after = None
        if order.inventory_item:
            inventory_item = InventoryItem.objects.select_for_update().get(
                id=order.inventory_item.id
            )
            inventory_item.quantity_in_stock += order.quantity
            inventory_item.save(update_fields=["quantity_in_stock"])
            stock_after = inventory_item.quantity_in_stock

        self._audit(
            AuditLog.ACTION_DELETE,
            str(session),
            "Removed order from session.",
            {
                "session_id": session.id,
                "order_id": order.id,
                "inventory_item_id": order.inventory_item_id,
                "quantity": order.quantity,
                "stock_after": stock_after,
            },
        )
        order.delete()
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def correct(self, request, pk=None):
        session = self.get_object()
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response(
                {"error": "Correction reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_values = self._correction_snapshot(session)

        if "resourceUnitId" in request.data or "stationId" in request.data:
            lookup = {"is_active": True}
            if request.data.get("resourceUnitId"):
                lookup["id"] = request.data.get("resourceUnitId")
            else:
                lookup["code"] = request.data.get("stationId")
            resource_unit = (
                ResourceUnit.objects.select_related("resource_type")
                .filter(**lookup)
                .first()
            )
            if not resource_unit:
                return Response(
                    {"error": "Resource unit not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            occupied = Session.objects.filter(
                resource_unit=resource_unit, end_time__isnull=True
            ).exclude(id=session.id).exists()
            if occupied:
                return Response(
                    {"error": f"Station {resource_unit.code} is already occupied."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            session.resource_unit = resource_unit

        if "startTime" in request.data:
            parsed, error = self._parse_datetime_value(
                request.data.get("startTime"), "startTime"
            )
            if error:
                return error
            session.start_time = parsed

        if "endTime" in request.data:
            end_time = request.data.get("endTime")
            if end_time in (None, ""):
                session.end_time = None
            else:
                parsed, error = self._parse_datetime_value(end_time, "endTime")
                if error:
                    return error
                session.end_time = parsed

        if session.end_time and session.start_time > session.end_time:
            return Response(
                {"error": "Start time must be before end time."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "discount" in request.data:
            discount, error = self._parse_money(request.data.get("discount"), "discount")
            if error:
                return error
            session.discount = discount

        session.save(
            update_fields=[
                "resource_unit",
                "start_time",
                "end_time",
                "discount",
            ]
        )

        for order_id in request.data.get("removeOrderIds", []):
            try:
                order = session.orders.select_related("inventory_item").get(id=order_id)
            except SessionOrder.DoesNotExist:
                return Response(
                    {"error": f"Order {order_id} was not found in this session."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if order.inventory_item:
                item = InventoryItem.objects.select_for_update().get(id=order.inventory_item_id)
                item.quantity_in_stock += order.quantity
                item.save(update_fields=["quantity_in_stock"])
            order.delete()

        for item in request.data.get("updateOrders", []):
            try:
                order = session.orders.select_related("inventory_item").get(
                    id=item.get("orderId")
                )
            except SessionOrder.DoesNotExist:
                return Response(
                    {"error": f"Order {item.get('orderId')} was not found in this session."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            quantity = self._parse_positive_quantity(item.get("quantity"))
            if quantity is None:
                return Response(
                    {"error": "Order quantity must be greater than zero."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            diff = quantity - order.quantity
            if diff and order.inventory_item:
                inventory_item = InventoryItem.objects.select_for_update().get(
                    id=order.inventory_item_id
                )
                if diff > 0 and inventory_item.quantity_in_stock < diff:
                    return Response(
                        {"error": f"Insufficient stock for {inventory_item.name}."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                inventory_item.quantity_in_stock -= diff
                inventory_item.save(update_fields=["quantity_in_stock"])
            order.quantity = quantity
            order.save(update_fields=["quantity", "total_price"])

        for item in request.data.get("addOrders", []):
            quantity = self._parse_positive_quantity(item.get("quantity", 1))
            if quantity is None:
                return Response(
                    {"error": "Order quantity must be greater than zero."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            inventory_item = (
                InventoryItem.objects.select_for_update()
                .filter(id=item.get("inventoryItemId"), is_active=True)
                .first()
            )
            if not inventory_item:
                return Response(
                    {"error": "Inventory item not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if inventory_item.quantity_in_stock < quantity:
                return Response(
                    {"error": f"Insufficient stock for {inventory_item.name}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            inventory_item.quantity_in_stock -= quantity
            inventory_item.save(update_fields=["quantity_in_stock"])
            SessionOrder.objects.create(
                session=session,
                inventory_item=inventory_item,
                item_name=inventory_item.name,
                quantity=quantity,
                unit_price=inventory_item.sale_price,
                unit_cost=inventory_item.cost_price,
                total_price=Decimal("0.00"),
            )

        session.refresh_from_db()
        self._recalculate_completed_session(session)
        session = self.get_queryset().get(id=session.id)
        new_values = self._correction_snapshot(session)

        self._audit(
            AuditLog.ACTION_UPDATE,
            str(session),
            f"Corrected session. Reason: {reason}",
            {
                "session_id": session.id,
                "reason": reason,
                "old_value": old_values,
                "new_value": new_values,
            },
        )
        return Response(self.get_serializer(session).data)
