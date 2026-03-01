# Deploy — Doacoes Gov Monitor

## Fluxo de deploy

```
Mac local → git push main → GitHub Actions → Tailscale VPN → SSH proxmox-ufg → pct push 101 → Container 101
```

## GitHub Secrets necessários

| Secret | Descrição |
|---|---|
| `DEPLOY_SSH_KEY` | Chave Ed25519 privada para SSH no Proxmox host |
| `DEPLOY_HOST` | `100.108.123.76` (IP Tailscale do Proxmox) |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth Client ID |
| `TS_OAUTH_SECRET` | Tailscale OAuth Secret |

> **Dica:** `TS_OAUTH_CLIENT_ID` e `TS_OAUTH_SECRET` são os mesmos usados no projeto AchadosPerdidos.

## Setup inicial (feito uma vez)

### 1. Instalar Node.js no container

```bash
ssh proxmox-ufg "pct exec 101 -- bash -c 'apt update && apt install -y nodejs && node --version'"
```

### 2. Criar diretório no container

```bash
ssh proxmox-ufg "pct exec 101 -- mkdir -p /opt/doacoes-gov-monitor"
```

### 3. Migrar .env e estado do bot antigo

```bash
# Copiar .env (já configurado na sessão anterior)
ssh proxmox-ufg "pct exec 101 -- cp /opt/telegram-bot/.env /opt/doacoes-gov-monitor/.env"

# Adicionar IDS_FILE ao .env
ssh proxmox-ufg "pct exec 101 -- bash -c 'echo IDS_FILE=/opt/doacoes-gov-monitor/ids_notificados.json >> /opt/doacoes-gov-monitor/.env'"

# Migrar IDs já notificados (evita re-notificações)
ssh proxmox-ufg "pct exec 101 -- bash -c 'cp /opt/telegram-bot/ids_notificados.json /opt/doacoes-gov-monitor/ 2>/dev/null || echo {\"ids\":[]} > /opt/doacoes-gov-monitor/ids_notificados.json'"
```

### 4. Criar serviço systemd

```bash
cat > /tmp/doacoes-monitor.service << 'EOF'
[Unit]
Description=Monitor de Doacoes GOV - Bot Telegram
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/doacoes-gov-monitor
EnvironmentFile=/opt/doacoes-gov-monitor/.env
ExecStart=/usr/bin/node /opt/doacoes-gov-monitor/index.js --loop
Restart=always
RestartSec=30
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

ssh proxmox-ufg "pct push 101 /tmp/doacoes-monitor.service /etc/systemd/system/doacoes-monitor.service"
ssh proxmox-ufg "pct exec 101 -- bash -c 'systemctl daemon-reload && systemctl enable doacoes-monitor.service'"
```

### 5. Desativar serviço antigo

```bash
ssh proxmox-ufg "pct exec 101 -- bash -c 'systemctl stop telegram-bot.service && systemctl disable telegram-bot.service'"
```

### 6. Gerar chave SSH de deploy

```bash
ssh-keygen -t ed25519 -C "github-actions-doacoes" -f ~/.ssh/doacoes-deploy-key -N ""

# Adicionar ao Proxmox host
ssh proxmox-ufg "cat >> /root/.ssh/authorized_keys" < ~/.ssh/doacoes-deploy-key.pub
```

### 7. Configurar GitHub Secrets

```bash
cd ~/doacoes-gov-monitor
gh secret set DEPLOY_SSH_KEY < ~/.ssh/doacoes-deploy-key
gh secret set DEPLOY_HOST --body "100.108.123.76"

# TS_OAUTH_CLIENT_ID e TS_OAUTH_SECRET:
# Copiar do repo AchadosPerdidos (Settings → Secrets → Actions)
```

---

## Comandos úteis

```bash
# Ver status do serviço
ssh proxmox-ufg "pct exec 101 -- systemctl status doacoes-monitor.service"

# Ver logs em tempo real
ssh proxmox-ufg "pct exec 101 -- journalctl -u doacoes-monitor.service -f"

# Reiniciar manualmente
ssh proxmox-ufg "pct exec 101 -- systemctl restart doacoes-monitor.service"

# Ver .env atual
ssh proxmox-ufg "pct exec 101 -- cat /opt/doacoes-gov-monitor/.env"

# Ver IDs notificados
ssh proxmox-ufg "pct exec 101 -- cat /opt/doacoes-gov-monitor/ids_notificados.json"

# Trigger deploy manual
gh workflow run deploy.yml

# Acompanhar deploy
gh run watch
```

---

## Regras importantes

- **NUNCA** edite arquivos diretamente no container via SSH
- **NUNCA** commite o `.env` (está no `.gitignore`)
- **SEMPRE** faça alterações pelo git e deixe o CI/CD fazer o deploy
- O `.env` no container é gerenciado **manualmente** (tokens não vão para o repo)

---

## Rollback

```bash
# Ver últimos commits
git log --oneline -5

# Reverter para commit anterior
git revert HEAD
git push origin main
# O CI/CD vai fazer o deploy da versão revertida automaticamente
```

---

## Servers

| Recurso | Valor |
|---|---|
| Proxmox host | `proxmox-ufg` / `100.108.123.76` |
| Container | LXC 101 |
| Diretório app | `/opt/doacoes-gov-monitor/` |
| Serviço systemd | `doacoes-monitor.service` |
| .env | `/opt/doacoes-gov-monitor/.env` |
| Estado | `/opt/doacoes-gov-monitor/ids_notificados.json` |
