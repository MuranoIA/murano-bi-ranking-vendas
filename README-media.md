# Música da tela de parabéns

A música que toca quando aparece a tela de parabéns **não fica mais no repo**
(nem numa pasta `media/`, como neste arquivo dizia antes). Quem troca é o admin,
pelo CRM, sem deploy:

> CRM → menu **Ranking** → **🎵 Música dos parabéns**

Aceita **MP3** ou **MP4**. Se for MP4, só o áudio é aproveitado — o vídeo é
descartado ainda no navegador de quem envia (o decodificador nem chega a ler a
trilha de imagem). Toca **20 segundos**, com fade no fim.

## Como chega aqui

1. O CRM corta o trecho no navegador do admin e guarda o arquivo no bucket
   público `ranking-musica` (Supabase `murano-conversas`).
2. O ponteiro vai para `bi_config.parabens_musica`
   (`{url, nome, segundos, cortado}`).
3. A edge function `bi-ranking-vendas` devolve isso como `d.musica`, tanto no
   payload normal (poll de 60s) quanto no `?comando=1` (poll de ~6s).
4. Este painel guarda em `MUSICA` e toca em `tocarMusica()`, num elemento
   `<audio>` — que ignora a trilha de vídeo caso a URL seja um `.mp4`.

Trocar a música no CRM vale nas TVs em ~6 segundos, sem recarregar nada.

**Sem música configurada**, o painel usa o som sintetizado de sempre (samba na
venda, pagode na meta batida). Para voltar a ele: botão *"Voltar ao som padrão"*
no mesmo modal do CRM.

## Autoplay

Navegador de TV costuma bloquear áudio antes de qualquer interação. Quando isso
acontece, aparece o botão **"Clique para ativar áudio"** no topo da tela — um
clique libera e vale para as comemorações seguintes daquela sessão.

## Teste local

```powershell
# a partir da pasta do repositório
python -m http.server 8000
# http://localhost:8000/index.html
```

Para ver a tela de parabéns, use o botão **"Parabéns por cliente"** no CRM (com
uma venda de hoje). O desfile (`?desfile=1`) roda **sem som** de propósito — o
som só entra na comemoração de venda nova e na meta batida.
