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

interface Municipio {
  nome: string;
  uf?: { sigla: string };
}

interface Anuncio {
  id: number;
  titulo?: string;
  quantidade?: number;
  municipio?: Municipio;
  dataExpiracao?: string;
  usuarioTipo?: { nome: string };
  possuiOnusOuEncargos?: boolean;
}

interface ApiResponse {
  anuncios: Anuncio[];
  totalElements?: number;
  materialCategorias?: Array<{ id: number; nome: string }>;
  ufs?: Array<{ id: number; sigla: string; nome: string }>;
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
  const params: Record<string, string> = {
    pesquisa: '',
    materialCategorias: String(categoryId),
    ufs: UFS_FILTRAR.join(','),
    inicio: '0',
    ordem: '1',
    anuncianteTipos: '',
    materialTipos: '',
    materialSituacoes: '',
    possuiOnusOuEncargos: '',
    numerosAnuncios: '',
    tpConsulta: '',
    anuncioSituacoes: '',
  };

  const { data } = await axios.get<ApiResponse>(
    'https://doacoes.gov.br/reuse/api/publico/anuncios/listar',
    {
      params,
      timeout: 30_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    }
  );

  return data?.anuncios ?? [];
}

function formatMessage(anuncio: Anuncio, categoria: string): string {
  const cidade = anuncio.municipio?.nome ?? '';
  const uf = anuncio.municipio?.uf?.sigla ?? '';
  const local = [cidade, uf].filter(Boolean).join('/');
  const tipo = anuncio.usuarioTipo?.nome ?? 'N/A';
  const possuiOnus = anuncio.possuiOnusOuEncargos ? 'Sim' : 'Não';
  const quantidade = anuncio.quantidade ?? 'N/A';

  let dataExp = anuncio.dataExpiracao ?? '';
  if (dataExp) {
    // Formato da API: "2026-01-29-00-00-00" → "2026-01-29"
    dataExp = dataExp.substring(0, 10);
  }

  const link = `https://doacoes.gov.br/anuncios/${anuncio.id}`;

  return [
    `🆕 <b>NOVO ANÚNCIO DE DOAÇÃO!</b>`,
    '',
    `📦 <b>${anuncio.titulo ?? 'Sem título'}</b>`,
    '',
    local ? `📍 <b>Local:</b> ${local}` : '',
    `📊 <b>Quantidade:</b> ${quantidade}`,
    `🏷️ <b>Categoria:</b> ${categoria}`,
    `🔄 <b>Tipo:</b> ${tipo}`,
    `💰 <b>Possui ônus:</b> ${possuiOnus}`,
    dataExp ? `📅 <b>Expira em:</b> ${dataExp}` : '',
    '',
    `🔗 <a href="${link}">Ver anúncio completo</a>`,
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
  // Busca categorias disponíveis via a própria API de listagem
  try {
    const { data } = await axios.get<ApiResponse>(
      'https://doacoes.gov.br/reuse/api/publico/anuncios/listar',
      {
        params: { pesquisa: '', inicio: '0', ordem: '1' },
        timeout: 30_000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      }
    );

    // A resposta inclui materialCategorias com as categorias disponíveis
    const cats = data.materialCategorias;
    if (cats && cats.length > 0) {
      console.log('\nCategorias disponíveis na API:');
      for (const cat of cats) {
        const monitored = CATEGORIES[cat.id] ? ' ← monitorada' : '';
        console.log(`  ${cat.id}: ${cat.nome}${monitored}`);
      }
    } else {
      throw new Error('Sem categorias na resposta');
    }
  } catch {
    console.log('\nCategorias monitoradas atualmente:');
    for (const [id, nome] of Object.entries(CATEGORIES)) {
      console.log(`  ${id}: ${nome}`);
    }
  }
}
