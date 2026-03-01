# Contexto do Projeto — Monitor Doações GOV

> **Para Claude Code:** Carregue este arquivo no início de cada conversa neste projeto.
> Ele contém todo o contexto necessário para trabalhar no código com eficiência.

---

## O que é este projeto

Bot TypeScript que monitora o portal `doacoes.gov.br` e envia alertas automáticos no Telegram quando novos anúncios de veículos são publicados. Roda 24/7 no servidor do usuário.

## Stack completa

| Tecnologia | Uso |
|---|---|
| TypeScript 5 + Node.js 20 | Runtime do bot |
| axios | HTTP requests (API doacoes.gov.br + Telegram) |
| esbuild | Bundle em arquivo único para produção |
| systemd | Gerenciamento do processo no servidor |
| GitHub Actions | CI/CD automático |
| Tailscale | VPN para acesso ao servidor via GitHub Actions |

## Infraestrutura

| Recurso | Valor |
|---|---|
| Proxmox host | `proxmox-ufg` (alias SSH) = `100.108.123.76` (Tailscale IP) |
| Container LXC | ID 101 — acesso via `ssh proxmox-ufg "pct exec 101 -- <cmd>"` |
| App path | `/opt/doacoes-gov-monitor/` |
| Binário produção | `/opt/doacoes-gov-monitor/index.js` (bundle esbuild) |
| .env produção | `/opt/doacoes-gov-monitor/.env` — **NUNCA versionado** |
| Estado | `/opt/doacoes-gov-monitor/ids_notificados.json` — **NUNCA versionado** |
| Serviço systemd | `doacoes-monitor.service` |

## Telegram

| Config | Valor |
|---|---|
| Grupo | "Alertas SDH" |
| Tópico | "Doações GOV" (THREAD_ID=3) |
| CHAT_ID | `-1003377430097` (número negativo = grupo) |
| THREAD_ID | `3` |

## Arquivos principais

```
src/
├── index.ts      # Entry point — CLI flags, loop, startup notification
├── config.ts     # Env vars tipadas + validateConfig()
├── telegram.ts   # sendMessage() com suporte a message_thread_id
└── monitor.ts    # checkDoacoes() — CATEGORIES dict, fetch API, formatMessage()
```

## Como adicionar uma nova categoria

Edite `src/monitor.ts`, array `CATEGORIES`:
```typescript
const CATEGORIES: Record<number, string> = {
  10: 'VEÍCULOS',
  12: 'AERONAVES',  // ← adicionar aqui
};
```

Use `npx tsx src/index.ts -- --list-categories` para ver os IDs disponíveis.

## Como filtrar por estado (UF)

Edite `src/monitor.ts`, array `UFS_FILTRAR`:
```typescript
const UFS_FILTRAR: string[] = ['GO', 'DF'];  // vazio = todas
```

## Deploy

Push para `main` → GitHub Actions faz tudo automaticamente:
1. `npm ci && npm run build` → `dist/index.js` (bundle único)
2. Conecta Tailscale
3. SSH no Proxmox host
4. `pct push 101 dist/index.js /opt/doacoes-gov-monitor/index.js`
5. `pct exec 101 -- systemctl restart doacoes-monitor.service`
6. Health check (`systemctl is-active`)
7. Rollback automático se falhar

## Comandos de diagnóstico

```bash
# Status do serviço
ssh proxmox-ufg "pct exec 101 -- systemctl status doacoes-monitor.service"

# Logs em tempo real
ssh proxmox-ufg "pct exec 101 -- journalctl -u doacoes-monitor.service -f"

# Enviar mensagem de teste (local)
npx tsx src/index.ts -- --test

# Trigger deploy manual
gh workflow run deploy.yml && gh run watch
```

## Regras do projeto

1. **NUNCA** edite arquivos diretamente no servidor
2. **NUNCA** commite `.env` ou `ids_notificados.json`
3. Sempre faça mudanças pelo git e deixe o CI/CD fazer o deploy
4. O `.env` no container é gerenciado manualmente
5. `ids_notificados.json` persiste entre deploys (não é sobrescrito)

## Projeto relacionado

`AchadosPerdidos` — `~/fullstack-project/` — Node.js/React/Prisma, mesmo padrão de CI/CD.
Mesmos Tailscale secrets (`TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`).
