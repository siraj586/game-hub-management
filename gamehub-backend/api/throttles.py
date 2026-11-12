from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Limits login and first-time setup attempts per IP address."""

    scope = "login"

    def get_cache_key(self, request, view):
        # Always keyed by IP, even if the request carries a valid token.
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }
