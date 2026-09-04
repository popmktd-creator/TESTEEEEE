# Julia Content Bot

Bot de automação de conteúdo para @eujuliasupa — carrosséis de Instagram para brasileiros nos EUA.

## O que faz
1. A cada 72h, busca pautas financeiras quentes com web search via Claude
2. Gera carrosséis de 6 slides com Claude claude-sonnet-4-20250514
3. Cria cards formatados no Trello na lista "🔍 Para Revisar"

## Persona — REGRAS ABSOLUTAS
- **NUNCA** usar: investimento, investir, invest, investidor
- **SEMPRE** focar em: proteção, planejamento financeiro, seguro de vida com benefício em vida, IUL, anuidades
- **NUNCA** comentar sobre status imigratório
- Tom: próximo, empático, português brasileiro, como amiga especialista
- Público: brasileiros imigrantes nos EUA

## Estrutura
```
julia-content-bot/
├── src/
│   ├── index.js      # Pipeline principal (busca → gera → publica no Trello)
│   └── scheduler.js  # Agendamento via cron (domingos, quartas, sextas às 9h ET)
├── .env              # Chaves de API (não comitar!)
├── .env.example      # Template das variáveis
└── package.json
```

## Variáveis de ambiente necessárias
| Variável | Onde obter |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys |
| `TRELLO_API_KEY` | trello.com/power-ups/admin |
| `TRELLO_TOKEN` | trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=SUA_KEY |
| `TRELLO_BOARD_ID` | URL do quadro + .json → campo "id" |

## Como rodar
```bash
# Instalar dependências (primeira vez)
npm install

# Executar uma vez (teste)
node src/index.js

# Iniciar agendador (72h)
node src/scheduler.js

# Com PM2 (recomendado para produção)
pm2 start src/scheduler.js --name julia-content-bot
pm2 save
pm2 startup
```

## Listas do Trello (criadas automaticamente)
- 🔍 Para Revisar — cards novos chegam aqui
- ✅ Aprovado — move manualmente após revisar
- 📱 Publicado — move após publicar no Instagram

## Modelo Claude
- Busca de pautas: `claude-sonnet-4-20250514` com tool `web_search_20250305`
- Geração de carrosséis: `claude-sonnet-4-20250514` sem web search
