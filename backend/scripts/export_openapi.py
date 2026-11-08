import json
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import create_app

app = create_app()
openapi_schema = app.openapi()

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "docs", "openapi.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(openapi_schema, f, indent=2)

print(f"{out_path} exported successfully!")
