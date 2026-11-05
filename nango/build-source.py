"""Create a YAML fragment from canonical JSON; no external dependencies."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
data = json.loads((root / "provider.json").read_text())

def yaml_lines(value, depth=0):
    indent = " " * depth
    if isinstance(value, dict):
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                yield indent + key + ":"
                yield from yaml_lines(child, depth + 4)
            else:
                yield indent + key + ": " + json.dumps(child)
    elif isinstance(value, list):
        for child in value:
            yield indent + "- " + json.dumps(child)

(root / "providers.fragment.yaml").write_text("\n".join(yaml_lines(data)) + "\n")
print("Wrote Nango provider fragment.")
