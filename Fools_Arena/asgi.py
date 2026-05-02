"""
ASGI config for Fools_Arena project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
    https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Fools_Arena.settings")

# Initialize Django before importing routing/consumers (they touch auth models).
from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter

from Fools_Arena.routing import websocket_application

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": websocket_application,
    }
)
