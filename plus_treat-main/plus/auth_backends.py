from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


class UsernameOrEmailBackend(ModelBackend):
    """
    Authenticate against either username or email using the same identifier field.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        identifier = username or kwargs.get("email") or kwargs.get("identifier")
        if identifier is None or password is None:
            return None

        UserModel = get_user_model()

        try:
            user = UserModel.objects.get(
                Q(username__iexact=identifier) | Q(email__iexact=identifier)
            )
        except UserModel.DoesNotExist:
            return None
        except UserModel.MultipleObjectsReturned:
            # Ambiguous identifier (usually duplicate emails); deny auth.
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
