#!/bin/bash
# Deploy manual — use apenas se o GitHub Actions estiver fora do ar
set -e

PROXMOX_HOST="proxmox-ufg"
CONTAINER_ID="101"
REMOTE_PATH="/opt/doacoes-gov-monitor/index.js"

echo "=== Build ==="
npm ci && npm run build

echo "=== Copiando bundle para Proxmox host ==="
scp dist/index.js root@100.108.123.76:/tmp/doacoes-index.js

echo "=== Deploy no container $CONTAINER_ID ==="
ssh "$PROXMOX_HOST" << EOF
set -e

echo "Backup..."
pct exec $CONTAINER_ID -- cp $REMOTE_PATH ${REMOTE_PATH}.bak 2>/dev/null || true

echo "Deploy..."
pct push $CONTAINER_ID /tmp/doacoes-index.js $REMOTE_PATH

echo "Restart..."
pct exec $CONTAINER_ID -- systemctl restart doacoes-monitor.service

echo "Health check..."
sleep 5
STATUS=\$(pct exec $CONTAINER_ID -- systemctl is-active doacoes-monitor.service)

if [ "\$STATUS" != "active" ]; then
  echo "FALHA! Rollback..."
  pct exec $CONTAINER_ID -- cp ${REMOTE_PATH}.bak $REMOTE_PATH
  pct exec $CONTAINER_ID -- systemctl restart doacoes-monitor.service
  exit 1
fi

echo "OK! Serviço: \$STATUS"
rm -f /tmp/doacoes-index.js
EOF

echo ""
echo "Deploy concluído!"
