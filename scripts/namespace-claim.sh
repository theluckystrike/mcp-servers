#!/usr/bin/env bash
# Claim an MCP registry namespace by proving control of a domain over DNS.
#
# Needs CLOUDFLARE_DNS_TOKEN: a Cloudflare API token with Zone -> DNS -> Edit on the zone.
# The token already in CLOUDFLARE_API_TOKEN cannot do this; it is read-only for DNS
# (measured 2026-09-07, see docs/NAMESPACE_R1.md).
#
# Usage: scripts/namespace-claim.sh <domain>
set -euo pipefail
DOMAIN="${1:?usage: namespace-claim.sh <domain>}"
: "${CLOUDFLARE_DNS_TOKEN:?set CLOUDFLARE_DNS_TOKEN to a token with Zone:DNS:Edit}"
KEYFILE="${KEYFILE:-$HOME/.config/mcp-publisher/dns-$DOMAIN.hex}"
mkdir -p "$(dirname "$KEYFILE")"

if [ ! -f "$KEYFILE" ]; then
  python3 - "$KEYFILE" <<'PY'
import sys, pathlib
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
k = Ed25519PrivateKey.generate()
priv = k.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
p = pathlib.Path(sys.argv[1]); p.write_text(priv.hex()); p.chmod(0o600)
print("generated", p)
PY
fi
PRIV=$(cat "$KEYFILE")
PUB=$(python3 - "$PRIV" <<'PY'
import sys, base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
k = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(sys.argv[1]))
print(base64.b64encode(k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode())
PY
)
ZID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" -H "Authorization: Bearer $CLOUDFLARE_DNS_TOKEN" \
  | python3 -c "import sys,json;r=(json.load(sys.stdin).get('result') or []);print(r[0]['id'] if r else '')")
[ -n "$ZID" ] || { echo "zone $DOMAIN not visible to this token" >&2; exit 1; }

echo "writing TXT on $DOMAIN"
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_DNS_TOKEN" -H "Content-Type: application/json" \
  --data "{\"type\":\"TXT\",\"name\":\"$DOMAIN\",\"content\":\"v=MCPv1; k=ed25519; p=$PUB\",\"ttl\":300}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('  created:',d.get('success'),d.get('errors') or '')"

# DNS needs a moment to be visible to the registry's resolver.
for i in 1 2 3 4 5 6 7 8; do
  if dig +short TXT "$DOMAIN" | grep -q "MCPv1"; then echo "  TXT visible"; break; fi
  echo "  waiting for TXT ($i)"; sleep 15
done

mcp-publisher login dns --domain "$DOMAIN" --private-key "$PRIV"
python3 - <<'PY'
import json, base64, pathlib
d = json.loads(pathlib.Path.home().joinpath(".config/mcp-publisher/token.json").read_text())
p = d["token"].split(".")[1]; p += "=" * (-len(p) % 4)
c = json.loads(base64.urlsafe_b64decode(p))
print("granted namespace:", [x["resource"] for x in c.get("permissions", [])])
PY
