require('dotenv').config();
const cron = require('node-cron');
const { execSync } = require('child_process');
const path = require('path');

// A cada 72 horas: 9h de domingo, quarta e sexta (horário de Nova York)
const CRON_SCHEDULE = '0 9 * * 0,3,5';

console.log('📅 Scheduler iniciado. Próxima execução: domingos, quartas e sextas às 9h ET.');
console.log('   Para forçar execução agora: node src/index.js\n');

cron.schedule(CRON_SCHEDULE, () => {
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/New_York' });
  console.log(`\n⏰ [${agora}] Iniciando pipeline automático...\n`);

  try {
    const scriptPath = path.join(__dirname, 'index.js');
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Erro no pipeline agendado:', err.message);
  }
}, {
  timezone: 'America/New_York',
});
