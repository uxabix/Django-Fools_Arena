"""Template context helpers for the project."""

from django.conf import settings


def asset_versions(_request):
    """Expose file mtimes so static URLs can bust browser cache after CSS/JS edits."""
    css = settings.BASE_DIR / "fools" / "static" / "fools" / "css" / "fools.css"
    js = settings.BASE_DIR / "fools" / "static" / "fools" / "js" / "play_table.js"
    try:
        css_v = int(css.stat().st_mtime)
    except OSError:
        css_v = 0
    try:
        js_v = int(js.stat().st_mtime)
    except OSError:
        js_v = 0
    return {"asset_css_v": css_v, "asset_js_v": js_v}
