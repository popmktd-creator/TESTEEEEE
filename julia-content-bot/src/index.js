require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TRELLO_BASE = 'https://api.trello.com/1';
const TRELLO_AUTH = {
  key: process.env.TRELLO_API_KEY,
  token: process.env.TRELLO_TOKEN,
};

const PALAVRAS_PROIBIDAS = ['investimento', 'investir', 'invest', 'investidor'];

const PERSONA_PROMPT = `
Você é assistente de conteúdo da Julia Supa (@eujuliasupa), agente financeira especializada
em proteger o futuro financeiro de brasileiros que vivem nos EUA.

REGRAS OBRIGATÓRIAS:
- NUNCA use as palavras: investimento, investir, invest, investidor (nem variações em inglês)
- Foque sempre em: proteção, planejamento financeiro, seguro de vida com benefício em vida, IUL (Indexed Universal Life), anuidades
- Nunca comente sobre status imigratório de ninguém
- Tom: próximo, empático, em português brasileiro — como uma amiga especialista
- Público: brasileiros imigrantes nos EUA (qualquer status)
- A Julia é a voz do conteúdo — escreva em primeira pessoa quando necessário
`;

async function buscarPautas() {
  console.log('[1/4] Buscando pautas financeiras quentes...');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `${PERSONA_PROMPT}

Pesquise na internet as 3 pautas financeiras mais relevantes e urgentes desta semana
que impactam diretamente brasileiros imigrantes nos EUA. Considere:
- Mudanças em taxas de juros, inflação, dólar
- Mudanças em leis de seguros ou benefícios nos EUA
- Notícias sobre previdência, aposentadoria, proteção familiar
- Tendências econômicas que afetam quem manda dinheiro para o Brasil

Para cada pauta retorne em JSON:
{
  "pautas": [
    {
      "titulo": "título da pauta",
      "resumo": "resumo de 2 linhas",
      "urgencia": "alta|media|baixa",
      "angulo_julia": "como a Julia pode abordar isso com foco em proteção/planejamento/IUL/anuidades"
    }
  ]
}

Retorne SOMENTE o JSON, sem texto adicional.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Nenhum texto retornado na busca de pautas');

  const raw = textBlock.text.trim().replace(/```json|```/g, '').trim();
  const data = JSON.parse(raw);
  console.log(`   Encontradas ${data.pautas.length} pautas.`);
  return data.pautas;
}

async function gerarCarrossel(pauta) {
  console.log(`[2/4] Gerando carrossel para: "${pauta.titulo}"`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `${PERSONA_PROMPT}

Crie um carrossel completo de Instagram com 6 slides sobre a seguinte pauta:

PAUTA: ${pauta.titulo}
RESUMO: ${pauta.resumo}
ÂNGULO DA JULIA: ${pauta.angulo_julia}

ESTRUTURA OBRIGATÓRIA DOS 6 SLIDES:
- Slide 1 (CAPA): Título impactante + subtítulo curto que gera curiosidade
- Slide 2 (PROBLEMA): Contextualiza o problema/situação que o seguidor enfrenta
- Slide 3 (IMPACTO): O que acontece se não agir — consequências reais
- Slide 4 (SOLUÇÃO): Como proteção, planejamento, IUL ou anuidade resolve isso
- Slide 5 (PROVA SOCIAL): Exemplo prático ou mini-história de cliente (fictícia, realista)
- Slide 6 (CTA): Chamada para ação clara — DM, link, salvar o post

REGRAS DE ESCRITA:
- Máximo 80 palavras por slide
- Linguagem direta, calorosa, sem juridiquês
- Use emojis com moderação (1-2 por slide)
- Nunca use: investimento, investir, invest, investidor

Retorne em JSON:
{
  "titulo_carrossel": "título principal",
  "data_sugerida": "sugestão de data de publicação (ex: quinta-feira, horário de pico 19h)",
  "slides": [
    { "numero": 1, "titulo": "CAPA", "conteudo": "texto do slide" },
    ...
  ],
  "legenda_post": "legenda completa para o post com hashtags relevantes"
}

Retorne SOMENTE o JSON.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Nenhum texto retornado na geração do carrossel');

  const raw = textBlock.text.trim().replace(/```json|```/g, '').trim();
  const carrossel = JSON.parse(raw);

  verificarPalavrasProibidas(carrossel);

  return carrossel;
}

function verificarPalavrasProibidas(carrossel) {
  const textoTotal = JSON.stringify(carrossel).toLowerCase();
  const encontradas = PALAVRAS_PROIBIDAS.filter((p) => textoTotal.includes(p));
  if (encontradas.length > 0) {
    console.warn(`   ⚠️  Palavras proibidas detectadas: ${encontradas.join(', ')} — revise o card no Trello`);
  }
}

function formatarDescricaoCard(pauta, carrossel) {
  const slidesFormatados = carrossel.slides
    .map((s) => `---\n**Slide ${s.numero} — ${s.titulo}**\n\n${s.conteudo}`)
    .join('\n\n');

  return `## 📌 Pauta\n**${pauta.titulo}**\n${pauta.resumo}\n\n## 📅 Data sugerida de publicação\n${carrossel.data_sugerida}\n\n## 🎠 Slides do Carrossel\n\n${slidesFormatados}\n\n---\n\n## 📝 Legenda do Post\n\n${carrossel.legenda_post}`;
}

async function garantirListasTrello(boardId) {
  const { data: listas } = await axios.get(`${TRELLO_BASE}/boards/${boardId}/lists`, {
    params: TRELLO_AUTH,
  });

  const nomesDesejados = ['🔍 Para Revisar', '✅ Aprovado', '📱 Publicado'];
  const listasExistentes = {};
  listas.forEach((l) => (listasExistentes[l.name] = l.id));

  for (const nome of nomesDesejados) {
    if (!listasExistentes[nome]) {
      console.log(`   Criando lista "${nome}" no Trello...`);
      const { data } = await axios.post(`${TRELLO_BASE}/lists`, null, {
        params: { ...TRELLO_AUTH, name: nome, idBoard: boardId },
      });
      listasExistentes[nome] = data.id;
    }
  }

  return listasExistentes['🔍 Para Revisar'];
}

async function criarCardTrello(pauta, carrossel, listId) {
  console.log(`[3/4] Criando card no Trello: "${carrossel.titulo_carrossel}"`);

  const corLabel = pauta.urgencia === 'alta' ? 'red' : pauta.urgencia === 'media' ? 'yellow' : 'green';

  const { data: card } = await axios.post(`${TRELLO_BASE}/cards`, null, {
    params: {
      ...TRELLO_AUTH,
      idList: listId,
      name: `🎠 ${carrossel.titulo_carrossel}`,
      desc: formatarDescricaoCard(pauta, carrossel),
    },
  });

  await axios.post(`${TRELLO_BASE}/cards/${card.id}/labels`, null, {
    params: {
      ...TRELLO_AUTH,
      color: corLabel,
      name: `Urgência ${pauta.urgencia}`,
    },
  });

  console.log(`   Card criado: ${card.url}`);
  return card;
}

async function validarEnv() {
  const obrigatorias = ['ANTHROPIC_API_KEY', 'TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_BOARD_ID'];
  const faltando = obrigatorias.filter((k) => !process.env[k]);
  if (faltando.length > 0) {
    throw new Error(`Variáveis de ambiente faltando: ${faltando.join(', ')}\nCopie .env.example para .env e preencha.`);
  }
}

async function main() {
  console.log('🤖 Julia Content Bot iniciando...\n');

  await validarEnv();

  const listId = await garantirListasTrello(process.env.TRELLO_BOARD_ID);
  console.log(`   Lista "🔍 Para Revisar" pronta.\n`);

  const pautas = await buscarPautas();

  for (const pauta of pautas) {
    try {
      const carrossel = await gerarCarrossel(pauta);
      await criarCardTrello(pauta, carrossel, listId);
      console.log(`   ✅ Carrossel criado com sucesso!\n`);
    } catch (err) {
      console.error(`   ❌ Erro ao processar pauta "${pauta.titulo}": ${err.message}`);
    }
  }

  console.log('[4/4] Pipeline concluído! Verifique os cards no Trello. 🎉');
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
