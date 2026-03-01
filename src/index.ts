import { config, validateConfig } from './config';
import { checkDoacoes, listCategories } from './monitor';
import { sendMessage, getChatUpdates } from './telegram';

const args = process.argv.slice(2);

async function main(): Promise<void> {
  // Comandos especiais (não precisam de token válido para --help)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Monitor de Doações GOV — Bot Telegram

Uso:
  node dist/index.js              Executa uma verificação e sai
  node dist/index.js --loop       Executa em loop contínuo (modo produção)
  node dist/index.js --test       Envia mensagem de teste no Telegram
  node dist/index.js --get-chat-id  Exibe chat_ids das conversas com o bot
  node dist/index.js --list-categories  Lista categorias disponíveis
  node dist/index.js --help       Exibe esta ajuda

Variáveis de ambiente (.env):
  TELEGRAM_TOKEN        Token do bot (@BotFather)
  TELEGRAM_CHAT_ID      ID do chat ou grupo
  TELEGRAM_THREAD_ID    ID do tópico no supergrupo (opcional)
  CHECK_INTERVAL_SEC    Intervalo entre verificações em segundos (padrão: 300)
  IDS_FILE              Caminho do arquivo de estado (padrão: ./ids_notificados.json)
`);
    return;
  }

  if (args.includes('--list-categories')) {
    await listCategories();
    return;
  }

  // Valida configuração antes de continuar
  validateConfig();

  if (args.includes('--get-chat-id')) {
    await getChatUpdates();
    return;
  }

  if (args.includes('--test')) {
    console.log('Enviando mensagem de teste...');
    const ok = await sendMessage(
      `🧪 <b>Teste — Monitor Doações GOV</b>\n\n✅ Bot funcionando!\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    );
    console.log(ok ? 'Mensagem enviada com sucesso!' : 'Falha ao enviar mensagem.');
    return;
  }

  if (args.includes('--loop')) {
    // Modo produção: loop contínuo
    console.log('🚀 Monitor de Doações GOV iniciado (modo loop)');
    console.log(`⏱  Intervalo: ${config.checkIntervalMs / 1000}s`);

    await sendMessage(
      `✅ <b>Monitor Doações GOV iniciado!</b>\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
    );

    // Primeira verificação imediata
    await checkDoacoes();

    // Loop
    setInterval(async () => {
      try {
        await checkDoacoes();
      } catch (err) {
        console.error('[index] Erro no loop de verificação:', err);
        await sendMessage(`⚠️ <b>Erro na verificação:</b>\n<code>${err}</code>`);
      }
    }, config.checkIntervalMs);

    return;
  }

  // Sem flag: executa uma vez e sai
  console.log('Executando verificação única...');
  await checkDoacoes();
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
