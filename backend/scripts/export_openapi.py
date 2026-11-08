import json

from app.main import create_app

app = create_app()
openapi_schema = app.openapi()

with open("docs/openapi.json", "w", encoding="utf-8") as f:
    json.dump(openapi_schema, f, indent=2)

print("docs/openapi.json exported successfully!")
