import axios from 'axios';
import * as fs from 'fs';
import { config } from './config';
import { sendMessage } from './telegram';

// =============================================================================
// CATEGORIAS MONITORADAS — edite aqui para adicionar novas categorias
// Use --list-categories para ver todas as disponíveis
// =============================================================================
const CATEGORIES: Record<number, string> = {
  10: 'VEÍCULOS',
  // 12: 'AERONAVES',
  // 107: 'COMPUTADORES',
  // 87: 'MOBILIÁRIO',
};

// UFs para filtrar (vazio = todas)
// Ex: ['GO', 'DF']
const UFS_FILTRAR: string[] = [];

// =============================================================================

interface Anuncio {
  id: number;
  titulo?: string;
  valorAvaliacao?: number;
  municipio?: { nome: string };
  uf?: { sigla: string };
  descricao?: string;
  situacao?: string;
}

interface ApiResponse {
  content: Anuncio[];
  totalElements: number;
}

function loadIds(): Set<string> {
  try {
    const raw = fs.readFileSync(config.idsFile, 'utf-8');
    const data = JSON.parse(raw) as { ids?: string[] };
    return new Set(data.ids ?? []);
  } catch {
    return new Set();
  }
}

function saveIds(ids: Set<string>): void {
  fs.writeFileSync(config.idsFile, JSON.stringify({ ids: [...ids] }, null, 2));
}

async function fetchAnnouncements(categoryId: number): Promise<Anuncio[]> {
  const body: Record<string, unknown> = {
    pagina: 0,
    tamanhoPagina: 20,
    categorias: [categoryId],
    situacao: 'DISPONIVEL',
  };

  if (UFS_FILTRAR.length > 0) {
    body.ufs = UFS_FILTRAR;
  }

  const { data } = await axios.post<ApiResponse>(
    'https://doacoes.gov.br/reuse/api/publico/anuncios/listar',
    body,
    { timeout: 30_000 }
  );

  return data?.content ?? [];
}

function formatMessage(anuncio: Anuncio, categoria: string): string {
  const valor = anuncio.valorAvaliacao != null
    ? `R$ ${anuncio.valorAvaliacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : 'Valor não informado';

  const local = [anuncio.municipio?.nome, anuncio.uf?.sigla]
    .filter(Boolean)
    .join(' - ');

  return [
    `🚗 <b>Novo anúncio: ${categoria}</b>`,
    '',
    `📋 <b>${anuncio.titulo ?? 'Sem título'}</b>`,
    local ? `📍 ${local}` : '',
    `💰 ${valor}`,
    `🔗 <a href="https://doacoes.gov.br/anuncio/${anuncio.id}">Ver anúncio</a>`,
  ]
    .filter(line => line !== undefined)
    .join('\n');
}

export async function checkDoacoes(): Promise<void> {
  const notifiedIds = loadIds();
  let hasNew = false;

  for (const [catId, catName] of Object.entries(CATEGORIES)) {
    let items: Anuncio[];

    try {
      items = await fetchAnnouncements(parseInt(catId));
    } catch (err) {
      console.error(`[monitor] Erro ao buscar categoria ${catName}:`, err);
      continue;
    }

    for (const item of items) {
      const id = String(item.id);

      if (!notifiedIds.has(id)) {
        notifiedIds.add(id);
        hasNew = true;

        const message = formatMessage(item, catName);
        await sendMessage(message);

        // Rate limiting — 1 mensagem por segundo
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (hasNew) saveIds(notifiedIds);

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  console.log(`[${timestamp}] Verificação concluída. Novos itens: ${hasNew ? 'sim' : 'não'}`);
}

export async function listCategories(): Promise<void> {
  // Busca categorias disponíveis na API
  try {
    const { data } = await axios.get(
      'https://doacoes.gov.br/reuse/api/publico/categorias',
      { timeout: 30_000 }
    );
    console.log('\nCategorias disponíveis:');
    const cats = Array.isArray(data) ? data : data.content ?? [];
    for (const cat of cats) {
      console.log(`  ${cat.id}: ${cat.nome}`);
    }
  } catch {
    console.log('\nCategorias monitoradas atualmente:');
    for (const [id, nome] of Object.entries(CATEGORIES)) {
      console.log(`  ${id}: ${nome}`);
    }
  }
}
