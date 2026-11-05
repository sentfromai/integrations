"""Apply this contribution to an explicitly supplied disposable Nango checkout.

No network calls. Refuses existing SentFromAI provider/assets instead of overwriting.
"""
import argparse
import json
import re
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("checkout", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent
checkout = args.checkout.resolve()
providers = checkout / "packages/providers/providers.yaml"
navigation = checkout / "docs/docs.json"
assert providers.is_file() and navigation.is_file(), "Expected a Nango checkout"
provider_text = providers.read_text()
assert not re.search(r"^sentfromai:", provider_text, re.M), "Provider already exists; review manually"
docs = json.loads(navigation.read_text())
groups = []

def visit(value):
    if isinstance(value, dict):
        if "APIs & Integrations" in value.get("group", "") and isinstance(value.get("pages"), list):
            groups.append(value["pages"])
        for child in value.values(): visit(child)
    elif isinstance(value, list):
        for child in value: visit(child)

visit(docs)
assert len(groups) == 1, "Expected one APIs & Integrations navigation group; inspect current docs.json"
pages = groups[0]
new_page = "integrations/all/sentfromai"
assert new_page not in pages
assets = [p for p in (root / "overlay").rglob("*") if p.is_file()]
for asset in assets:
    assert not (checkout / asset.relative_to(root / "overlay")).exists(), f"Asset already exists: {asset}"
fragment = (root / "providers.fragment.yaml").read_text()
next_match = next((m for m in re.finditer(r"^([a-z0-9-]+):", provider_text, re.M) if m.group(1) > "sentfromai"), None)
point = next_match.start() if next_match else len(provider_text)
new_provider_text = provider_text[:point] + fragment + provider_text[point:]
point = next((i for i, item in enumerate(pages) if isinstance(item, str) and item.split("/")[-1] > "sentfromai"), len(pages))
pages.insert(point, new_page)
# All preflight checks finish before mutations begin.
providers.write_text(new_provider_text)
navigation.write_text(json.dumps(docs, indent=2, ensure_ascii=False) + "\n")
for asset in assets:
    destination = checkout / asset.relative_to(root / "overlay")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(asset, destination)
print("Applied provider, navigation and documentation/logo assets. Review git diff before submission.")
