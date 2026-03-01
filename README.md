# 🚗 Monitor Doações GOV

Bot Telegram que monitora o portal [doacoes.gov.br](https://doacoes.gov.br) e envia alertas automáticos quando novos anúncios de veículos (ou outras categorias) são publicados.

## Stack

- **Runtime**: Node.js 20+ (TypeScript compilado via esbuild)
- **HTTP**: axios
- **Deploy**: GitHub Actions → Proxmox LXC 101 via `pct push`
- **Serviço**: systemd (`doacoes-monitor.service`)
- **Alertas**: Telegram (supergrupo "Alertas SDH", tópico "Doações GOV")

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Copiar e configurar variáveis
cp .env.example .env
# Edite .env com seus tokens

# Rodar em modo dev (com hot-reload)
npm run dev

# Verificação única
npx tsx src/index.ts

# Testar envio Telegram
npx tsx src/index.ts -- --test

# Obter chat_id
npx tsx src/index.ts -- --get-chat-id

# Listar categorias
npx tsx src/index.ts -- --list-categories
```

## Build

```bash
npm run build       # Gera dist/index.js (bundle único)
npm run type-check  # Verifica tipos TypeScript
npm run lint        # Lint do código
```

## Adicionar nova categoria

Edite `src/monitor.ts`:

```typescript
const CATEGORIES: Record<number, string> = {
  10: 'VEÍCULOS',
  12: 'AERONAVES',   // ← adicione aqui
};
```

Execute `npx tsx src/index.ts -- --list-categories` para ver todas as categorias disponíveis.

## Deploy

Push para `main` → GitHub Actions faz o deploy automaticamente.

Ver [DEPLOY.md](./DEPLOY.md) para detalhes de setup e troubleshooting.

## Estrutura

```
src/
├── index.ts      # Entry point, CLI flags, loop principal
├── config.ts     # Variáveis de ambiente tipadas
├── telegram.ts   # sendMessage() com suporte a tópicos de grupo
└── monitor.ts    # Fetch API doacoes.gov.br + formatação de alertas
```
