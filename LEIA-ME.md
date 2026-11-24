# A Jornada da Transparência

Jogo educativo em 3D para o **Dia da Transparência (18 de novembro)**. Realização: Controladoria Geral do Município (CGM) e CRI – Comitê de Relações Institucionais.

O jogador percorre uma cidade, visita 8 prédios temáticos e conversa com os personagens de cada um. Ele lê uma curiosidade, responde a uma pergunta de múltipla escolha e libera a próxima área. No fim, enfrenta o **Corrupson** na Torre da Transparência: uma batalha de três perguntas, com barra de vida.

Ao longo da jornada o tempo passa. O jogo começa numa manhã de primavera, segue pelo verão (com uma pancada de chuva) e pelo outono, tem pôr do sol, e o desafio final acontece numa noite fria de inverno.

---

## Como executar

O jogo **não precisa de servidor, instalação nem internet**.

1. Descompacte a pasta `jornada-transparencia` em qualquer lugar do computador.
2. Dê dois cliques em **`index.html`**. Ele abre no navegador padrão.
3. Aperte **F11** para tela cheia e clique em **INICIAR A AVENTURA**. Na tela inicial também ficam **SELECIONAR FASE**, **COMO JOGAR** (tutorial com os controles) e **CRÉDITOS**; use as setas ↑ ↓ e ENTER para escolher.

Navegadores recomendados: **Google Chrome** ou **Microsoft Edge** atualizados. O Firefox também funciona.

> Se algum navegador bloquear a abertura direta do arquivo, abra a pasta num servidor local simples, por exemplo com `python -m http.server` dentro da pasta, e acesse `http://localhost:8000`.

## Controles

| Tecla | Ação |
|---|---|
| ↑ / ↓ | Andar para frente / para trás |
| ← / → | Girar o personagem |
| SHIFT | Correr |
| ESPAÇO | Pular. Perto de uma porta, do chefe ou de um personagem: entrar, conversar e avançar o diálogo |
| A, B, C, D | Responder (ou use as setas e ESPAÇO, ou clique) |
| ESC | Abrir o menu: continuar, como jogar, som e sair do jogo. Também fecha diálogos e o mapa |
| M | Abrir o mapa ampliado |
| Mouse (mover para os lados) | Girar a personagem no próprio eixo, sem precisar clicar |
| Mouse (mover para cima/baixo) | Olhar para cima (até o céu, quase na vertical) ou para baixo |
| Roda do mouse | Aproximar ou afastar a câmera |
| C | Recentrar a inclinação e o zoom da câmera |

### Celular e tablet (toque)

O jogo funciona no navegador do celular e do tablet, com os mesmos arquivos. A troca de controles é **automática**: ao tocar na tela, os controles de toque aparecem; ao usar teclado ou mouse (por exemplo, um tablet com teclado), eles somem e tudo volta a ser como no PC. Os textos de ajuda, o tutorial **COMO JOGAR** e os avisos na tela acompanham o modo.

| Toque | Ação |
|---|---|
| Joystick (metade esquerda da tela) | Arraste o dedo para andar e girar. Empurrado até a borda, corre. O joystick aparece onde o dedo tocar |
| Arrastar na metade direita | Girar a personagem e olhar para cima ou para baixo |
| Pinça com dois dedos | Aproximar ou afastar a câmera |
| Toque duplo na metade direita | Recentrar a câmera |
| Botão redondo (canto inferior direito) | Pular. Perto de uma porta ou pessoa, ele fica âmbar e vira ENTRAR, CONVERSAR, VOLTAR… O aviso "TOQUE EM ENTRAR" também funciona como botão |
| Botão ☰ | Menu de pausa (o mesmo do ESC) |
| Minimapa | Toque para abrir o mapa ampliado |
| ✕ no diálogo | Fechar o diálogo (o mesmo do ESC) |

- **Na horizontal:** no celular, o jogo pede para girar o aparelho. No tablet funciona nas duas posições.
- **Tela cheia:** no Android e no iPad, o jogo entra em tela cheia ao começar a partida. No iPhone, o Safari não permite: use **Compartilhar → Adicionar à Tela de Início**; aberto pelo ícone, o jogo ocupa a tela toda. No Android, **Adicionar à tela inicial** faz o mesmo.
- **Desempenho:** em celulares e tablets o jogo usa as configurações de `celular` em `CT.CONFIG` (`js/data.js`): sem sombras e resolução menor. Em qualquer aparelho, se a imagem ficar lenta, a resolução cai sozinha e volta a subir quando houver folga (`resolucaoAdaptativa`).
- **Sensibilidade:** o giro da câmera ao arrastar o dedo fica em `celular.sensibilidadeToque`.
- O jogo precisa estar num endereço web (como o GitHub Pages) para abrir no celular.

## A jornada

| Etapa | Prédio | Personagem |
|---|---|---|
| 1 | Portal da Transparência | Prefeito |
| 2 | Acesso à Informação (LAI) | Roberto |
| 3 | Ouvidoria | Lorena |
| 4 | Controle Social | Seu Carlos |
| 5 | Proteção de Dados (LGPD) | Dra. Beatriz |
| 6 | Licitações e Contratos | João |
| 7 | Obras Públicas | Eng.ª Paula |
| 8 | Dados Abertos | Lucas |
| ★ | Torre da Transparência | Corrupson (chefe final) |

Os textos de Seu Lima, das estações 1 a 7, do Corrupson e da tela final seguem o roteiro revisado pela equipe em 12/11 (na estação 1, as falas do roteiro são ditas pelo Prefeito). Cada página de fala pode ter vários parágrafos, separados por uma linha em branco (`\n\n` no texto, em `js/data.js`). O campo `falaConcluido` de cada estação é a frase dita quando o jogador volta a falar com o servidor depois de concluir a estação. A estação 8 (Dados Abertos) não estava no roteiro revisado e continua com o texto anterior.

- A cidade tem 9 bairros ligados por ruas. Cada passagem entre bairros fica fechada por um **portão** (cancela, grades e cones).
- Cada resposta certa vale **100 pontos + bônus de rapidez** (veja abaixo). Ao sair do prédio, o portão abre com uma animação e libera o bairro seguinte.
- Errar não tira pontos: o personagem explica a resposta certa e o jogador tenta de novo, mas o tempo daquela pergunta continua correndo (e o bônus de rapidez diminuindo).
- No mapa, os prédios aparecem em **cinza** (bloqueado), **âmbar** (disponível) ou **verde** (concluído). Uma seta amarela no chão aponta o caminho.
- Pontuação máxima: **2.200 pontos** (11 perguntas: 8 prédios + 3 do chefe final, cada uma valendo até 200).

### Pontuação e ranking

- **Pontuação:** cada resposta certa vale **100 pontos** + um **bônus de rapidez** de até **100 pontos**. O bônus fica completo nos primeiros 5 segundos e depois cai 3 pontos por segundo (zera em cerca de 38 segundos). Durante a pergunta, um indicador "Rapidez +N" mostra o bônus diminuindo.
- **Tempo de resposta:** começa quando a caixa com a pergunta aparece e para na resposta certa. A leitura da curiosidade, antes da pergunta, não conta; tentativas erradas contam. Se o jogador fechar o diálogo e voltar depois, o cronômetro daquela pergunta continua de onde parou.
- **Tempo de partida:** um cronômetro no painel mostra o tempo total da partida (pausa não conta). Ele serve de desempate no ranking.
- **Fim da partida:** ao vencer ou ao encerrar pelo menu (ESC → SAIR DO JOGO), aparece a tela de resultado com pontos, acertos e tempo. O jogador **digita o nome** e a partida entra no ranking. Depois aparecem a posição dele e os 10 primeiros colocados.
- Se o jogador sair pelo menu **sem ter respondido nenhuma pergunta**, nada é registrado e o jogo volta direto à tela inicial.
- **Ranking:** no menu principal, **RANKING** mostra as partidas registradas, ordenadas por pontos, depois acertos, depois menor tempo. Cada linha mostra o resultado (Venceu ou Encerrou) e indica se a partida começou por uma fase escolhida em SELECIONAR FASE.
- **Onde o ranking fica guardado:** há dois modos.
  - **Compartilhado (Firebase):** com o projeto Firebase configurado (veja **Ranking compartilhado** abaixo), todos os aparelhos (PC, celular, tablet) gravam e leem o mesmo ranking, atualizado ao vivo. A janela do ranking mostra "● ao vivo" quando está conectada. Se a internet cair, a partida fica guardada no aparelho e é enviada sozinha quando a conexão voltar, mesmo que o jogo seja fechado.
  - **Local:** sem a configuração do Firebase, o ranking fica no navegador do próprio computador, sem internet e sem servidor. Ele continua lá depois de fechar e abrir o jogo, desde que seja o **mesmo computador e o mesmo navegador**. Uma janela anônima ou a limpeza dos dados de navegação apaga o ranking.
- **Exportar e limpar:** na tela do ranking, **EXPORTAR PLANILHA (CSV)** baixa todas as partidas num arquivo que abre no Excel ou no LibreOffice (bom para premiar os vencedores ou guardar o histórico). No modo local, **LIMPAR RANKING** apaga tudo; é preciso clicar duas vezes para confirmar. No modo compartilhado esse botão não aparece (senão qualquer jogador apagaria o ranking de todos): veja abaixo como começar um ranking novo.
- Para mudar os valores, edite `pontosPorAcerto` e `bonusRapidez` em `CT.CONFIG` (`js/data.js`). O texto da tela de partida encerrada fica em `CT.ENCERRADA`.

### Batalha contra o Corrupson

- O chefe faz **3 perguntas** e tem uma **barra de vida** com 3 partes, no alto da tela.
- Cada acerto é um golpe: a barra diminui, o robô treme e pisca em vermelho, solta faíscas e faz um som de dano. Cada acerto vale 100 pontos + bônus de rapidez.
- No **último golpe**, o Corrupson vira uma nuvem de **fumaça** e some. Em seguida, a torre se acende e aparece a tela de vitória.
- Errar não tira pontos: o chefe zomba, explica o erro e a pergunta continua (com o tempo correndo).
- Se o jogador sair da batalha (ESC), o dano já causado fica guardado e a batalha continua da pergunta seguinte.
- Em telas largas, o chefe aparece à esquerda e as perguntas à direita. Em telas estreitas, as perguntas ficam embaixo.

### Escolha de personagem

- Ao clicar em **INICIAR A AVENTURA** (ou escolher uma fase), aparece a tela **Escolha sua personagem**, com 6 opções: **Ana** (estudante de jornalismo, criada a partir de um desenho: tranças nagô com rabo de tranças em degradê sobre o ombro, argolas douradas, pinta na testa, batom vermelho, camisa social listrada com decote em V, relógio prateado, calça marrom com cinto e correntes), **Helena** (professora de história, criada a partir de um desenho: cabelo castanho-escuro liso e comprido, sorriso aberto, blusa branca de manga bufante e colar dourado com pingente de coração), **Caio** (músico e líder comunitário, criado a partir de um desenho: barba cheia, cabelo curto com degradê, sorriso com aparelho, camiseta vermelha de manga curta e corrente dourada com crucifixo), **Paulo** (jornalista investigativo, criado a partir de um desenho: cabelo preto curto, sorriso largo, terno azul, camisa branca e gravata vinho), **Luana** (comunicadora digital, criada a partir de um desenho: cabelo preto liso e comprido, sorriso aberto de batom vermelho, delineado, jaqueta jeans aberta e blusa amarela) e **Seu Antônio** (contador aposentado, criado a partir de um desenho: cabelo e sobrancelhas grisalhos, rugas, sorriso tranquilo, camisa social azul-marinho e relógio preto no pulso).
- A personagem aparece em 3D ao lado do painel e acena quando é escolhida. Use as setas ← → (ou clique nos cartões) e ENTER para começar; ESC volta ao menu.
- O jogo lembra a última escolha neste computador. Textos como "Bem-vinda/Bem-vindo" e o título da vitória ("Guardiã/Guardião da Transparência") acompanham a personagem, e o ranking mostra com quem cada partida foi jogada.
- Para mudar nomes, descrições, cores ou acessórios, edite `CT.PERSONAGENS` em `js/data.js`.

### Seleção de fases

- Na tela inicial, **SELECIONAR FASE** mostra os 8 prédios e o chefe final.
- Ao escolher uma fase, o jogo começa na porta daquele prédio, no horário e na estação dele. As fases anteriores ficam liberadas (portões abertos), mas só as respostas dadas na partida somam pontos.
- É útil para retomar uma partida interrompida ou para apresentar um tema específico no evento.

## Tempo, estações e clima

A cada prédio concluído, quando o jogador sai e o portão se abre, o ambiente muda aos poucos (cerca de 9 segundos): posição do sol, cor do céu, sombras, nuvens, chuva e estação. Um relógio no painel mostra a hora fictícia, a estação e o clima.

| Prédios concluídos | Hora | Estação | Clima |
|---|---|---|---|
| 0 (início) | 08:00 | Primavera | Ensolarado |
| 1 | 09:30 | Primavera | Parcialmente nublado |
| 2 | 11:00 | Verão | Ensolarado (sol forte) |
| 3 | 12:30 | Verão | Nublado |
| 4 | 14:00 | Verão | Chuva forte, com trovões |
| 5 | 15:15 | Outono | Chuva fraca |
| 6 | 16:15 | Outono | Tempo abrindo |
| 7 | 17:45 | Outono | Pôr do sol |
| 8 (chefe final) | 19:30 | Inverno | Noite, garoa |
| Vitória | 20:15 | Inverno | Céu limpo e estrelado |

O que muda na tela:

- **Primavera:** árvores verde-claras, flores nos canteiros, gramados e vasos, e pétalas no ar.
- **Verão:** sol mais forte, céu azul intenso e sombras marcadas.
- **Outono:** árvores amarelas, laranja e vermelhas, folhas caindo e luz dourada.
- **Inverno:** luz mais fria, céu nublado e vegetação acinzentada.
- **Chuva:** gotas, céu escuro, ruas molhadas com reflexo, poças que secam devagar e som de chuva. Na chuva forte também há trovões.
- **Noite:** postes acesos com luz no chão, janelas iluminadas, lua e estrelas. Uma luz suave acompanha o personagem para não atrapalhar o jogo.

**Para mudar a sequência**, edite `CT.TEMPO` em `js/data.js`. Há uma linha para cada quantidade de prédios concluídos, com `hora`, `estacao` e `clima`. Os climas disponíveis ficam em `CT.CLIMAS`, onde também dá para ajustar a quantidade de nuvens e de chuva. A duração da transição fica em `CT.CONFIG.duracaoTransicaoTempo`.

Para testar sem jogar, abra o console (F12) e digite, por exemplo, `CT.debug.tempo(4)` para ver a chuva forte, `CT.debug.tempo(8)` para a noite ou `CT.debug.tempo("vitoria")`.

## Modelos 3D

Os personagens têm esqueleto (rig) e animações: parado, andar, correr, acenar, concordar, negar com a cabeça e comemorar (samba ou aplausos). Os carros e o mobiliário urbano são modelos prontos. Todos os arquivos ficam dentro do projeto e nada é baixado durante o jogo.

| Uso | Arquivo | Origem e licença |
|---|---|---|
| Personagens femininas de apoio e pedestres | `michelle.glb` | Personagem do **Mixamo** (Adobe), tirado do repositório oficial do Three.js. Uso gratuito em projetos, inclusive institucionais; não pode ser redistribuído como arquivo avulso. Roupa, cabelo e tom de pele são recoloridos por personagem. |
| Base do Paulo | `rpm-homem-a.glb` | Avatar **Ready Player Me**, tirado do repositório oficial do Three.js (não é usado diretamente no jogo: serve de base para o script gerador). Licença **Creative Commons 4.0 para uso não comercial** (um jogo educativo gratuito, como este, é uso não comercial). Para reduzir o tamanho, as expressões faciais foram retiradas e as texturas convertidas para JPEG. |
| Base do Caio, do Seu Antônio e do Seu Lima | `rpm-homem-b.glb` | Avatar **Ready Player Me**, tirado do repositório de recursos do Babylon.js. Mesma licença e mesmos ajustes do anterior. Não é usado diretamente no jogo: serve de base para os scripts geradores. |
| Helena (personagem do desenho) | `helena.glb` | Gerada a partir do desenho enviado pela equipe (`ferramentas/personagem-desenho/desenho-helena.png`), sobre a Michelle do Mixamo. O script `ferramentas/personagem-desenho/gerar_helena.py` segue o processo da Luana: cabelo castanho-escuro liso e comprido, sem franja (malha nova), sorriso aberto, delineado e sobrancelhas mais finas, blusa branca com mangas curtas bufantes (casca sobre o tronco e o alto dos braços), calça jeans e colar dourado com pingente de coração. |
| Lorena (ouvidora, prédio 3) | `lorena.glb` | Gerada a partir do desenho enviado pela equipe (`ferramentas/personagem-desenho/desenho-lorena.png`), sobre a Michelle do Mixamo. O script `ferramentas/personagem-desenho/gerar_lorena.py` segue o processo da Helena: cabelo preto, comprido e ondulado, com risca no meio e preso atrás das orelhas (malha nova), pele morena, delineado gatinho, sorriso aberto, brincos de pérolas em flor (malhas novas) e blusa de malha listrada de azul-marinho e creme, de mangas compridas e gola redonda (casca sobre o tronco e os braços até os punhos). |
| Prefeito (desenho) | `prefeito.glb` | Gerado a partir do desenho enviado pela equipe (`ferramentas/personagem-desenho/desenho-prefeito.jpg`), sobre o avatar `rpm-homem-b.glb` (mesma licença), com `gerar_senhor.py prefeito`: sorriso leve de boca fechada, pele morena, calvo no alto e na frente com cabelo escuro nas laterais e atrás (têmporas levemente grisalhas), sobrancelhas escuras, óculos de armação fina e retangular (malha nova), camisa social branca de mangas compridas com gola e o primeiro botão aberto, calça escura e sapatos sociais pretos. É o atendente do prédio 1 (no lugar da Ana Clara), sentado à mesa de gabinete. |
| Paulo (personagem do desenho) | `paulo.glb` | Gerado a partir do desenho enviado pela equipe (`ferramentas/personagem-desenho/desenho-paulo.png`), sobre o avatar `rpm-homem-a.glb` (mesma licença). O script `ferramentas/personagem-desenho/gerar_paulo.py` dá o sorriso aberto (expressões do avatar original, em `sorriso-paulo.npz`), pinta pele morena, sobrancelhas e cabelo preto curto (com camada de volume), tira chapéu, cabelo cacheado e bigode, transforma a casaca em paletó azul na altura do quadril (sem as abas), o colete na frente da camisa branca, tira gravata-borboleta, rosa e botões, cria a gravata vinho e pinta o bolso do peito; calça azul e sapatos escuros. |
| Ana (personagem do desenho) | `ana.glb` | Gerada a partir do desenho enviado pela equipe (`ferramentas/personagem-desenho/desenho-ana.png`), sobre a Michelle do Mixamo (mesmas condições de uso). O script `ferramentas/personagem-desenho/gerar_ana.py` segue o processo da Luana: tira os coques, os fones e os óculos, afina as sobrancelhas, pinta a pele, o sorriso com batom vermelho, o delineado gatinho e a pinta na testa, cria a touca de tranças nagô e o rabo de tranças onduladas (do castanho-escuro ao caramelo) caindo sobre o ombro esquerdo, a camisa social bege listrada (gola, decote em V, botões e punhos), as argolas douradas, o relógio prateado de mostrador quadrado no pulso esquerdo e a calça marrom com cinto e correntes douradas. |
| Caio (personagem do desenho) | `caio.glb` | Gerado a partir do desenho enviado pela equipe (`ferramentas/personagem-desenho/desenho-caio.png`), sobre o avatar `rpm-homem-b.glb` (mesma licença). O script `ferramentas/personagem-desenho/gerar_caio.py` dá o sorriso largo com dentes, pinta a pele, as sobrancelhas grossas, a barba cheia com bigode (em relevo: uma camada grossa colada ao rosto e, por cima, cinco camadas de pelos com transparência, cada uma mais rala, para dar volume e borda felpuda) e o cabelo curto crespo com degradê nas laterais, pinta o aparelho nos dentes de cima, transforma a bata numa camiseta vermelha de manga curta (com braços de pele novos), cria a corrente dourada com crucifixo e troca calça e calçado por jeans escuro e tênis claro. |
| Luana (personagem do desenho) | `mulher-jaqueta.glb` | Gerada a partir do desenho enviado pela equipe, sobre a Michelle do Mixamo (mesmas condições de uso). O script `ferramentas/personagem-desenho/gerar_mulher.py` tira os coques, os fones e os óculos da Michelle, cria um cabelo preto liso e comprido (malha nova, presa à cabeça e às costas), pinta a pele morena, o sorriso aberto com dentes e batom vermelho e o delineado gatinho, troca a regata por uma blusa amarela de tricô e a calça amarela por uma escura, e cria a jaqueta jeans aberta (gola, lapelas, bolsos, botões e pespontos). |
| Seu Antônio (personagem do desenho) | `senhor-camisa.glb` | Gerado a partir do desenho enviado pela equipe, sobre o mesmo avatar do Caio (mesma licença). O script `ferramentas/personagem-desenho/gerar_senhor.py` dá um sorriso leve de boca fechada (expressões faciais do avatar original, guardadas em `sorriso-senhor.npz`), tira o cavanhaque, pinta rugas, pele morena, cabelo curto e sobrancelhas grisalhos (com uma camada de volume sobre a cabeça), transforma a bata em camisa social azul-marinho de manga comprida com gola, carcela e botões, escurece calça e sapatos e cria o relógio de pulseira preta no pulso esquerdo. |
| Seu Lima (guarda municipal) | `guarda-lima.glb` | Feito a partir da foto enviada pela equipe, sobre o mesmo avatar do Caio (mesma licença). O mesmo script, com a opção `guarda` (`python3 ferramentas/personagem-desenho/gerar_senhor.py guarda`), dá o sorriso largo com dentes (`sorriso-guarda.npz`), pinta pele, cabelo raspado e sobrancelhas, e veste a farda azul-marinho escura: platinas com friso amarelo, tarjeta dourada "GM LIMA", brasões no peito e nos braços, bolsos, cinto com fivela e calça escura. Também cria o boné de guarda (copa ajustada à cabeça, aba curva e brasão dourado) e os coturnos pretos (cano por cima da barra da calça, bico arredondado). |
| Corrupson (chefe final) | `corrupson.glb` | Feito a partir do desenho enviado pela equipe (`ferramentas/corrupson/desenho-corrupson.jpg`). O script `ferramentas/corrupson/gerar_corrupson.py` modela o corpo peludo preto (cabeça e tronco num bloco só, pelos serrilhados), os tufos espetados no alto e nos ombros, os braços compridos com mãos de dedos grossos, as pernas curtas e pés grandes, os olhos amarelos zangados com brilho e a boca com contorno amarelo, presas brancas e língua vermelha. A malha é presa ao esqueleto do robô do chefe (RobotExpressive, CC0), por isso usa as mesmas animações dele: parado, dança/provocação, "não" com a cabeça, aceno, queda. |
| Personagens masculinos e pedestres | `worker.glb` | *Worker*, do **Ultimate Animated Character Pack** de **Quaternius**, **domínio público (CC0)**. Pele, cabelo, camisa e calça recebem cores próprias de cada personagem. |
| Pedestres | `adventurer.glb` | *Adventurer*, de **Quaternius**, **domínio público (CC0)**. |
| Animações das protagonistas | `xbot.glb` | *X Bot* do **Mixamo**. Não aparece no jogo: fornece as animações de parado, andar, correr, concordar e negar, adaptadas ao esqueleto de todos os protagonistas (o jogo corrige automaticamente a diferença entre a pose T do X Bot e a pose A dos avatares). |
| Carros, postes, semáforos, bancos, hidrantes, caçambas e lojas | `car_*.glb`, `streetlight.glb` etc. | **KayKit City Builder Bits**, de Kay Lousberg, **domínio público (CC0)**. Ver `assets/modelos/LICENCA-KayKit-CC0.txt`. |

**De onde vieram os modelos?** O ambiente em que o jogo foi montado não tinha acesso direto ao Mixamo, ao Sketchfab nem ao Poly Pizza. Os modelos vieram de cópias com licença conhecida, obtidas pelo GitHub e pelo npm. Os da Quaternius são os mesmos que ele publica no Poly Pizza como domínio público; veja `assets/modelos/NOTICE-netforge-CC0.txt`. A estrutura já está pronta para receber outros modelos dessas bibliotecas.

### Variedade dos personagens

Cada NPC tem modelo, tom de pele, cor de cabelo, roupa, altura, porte físico e acessório próprios, definidos em `CT.PREDIOS` (campos `modelo`, `pele`, `cabelo`, `camisa`, `calca`, `altura`, `corpo`, `acessorio`). Acessórios disponíveis: `oculos`, `headset`, `capacete`, `chapeu`, `bigode`, `gravata` e `cracha`.

Os pedestres são sorteados com a mesma variedade, mas são sempre os mesmos a cada partida. As listas de cores ficam em `js/world.js`, no trecho `PED`.

Personagens sem animação própria de "não" ou de aceno fazem esses gestos de forma procedural: balançam a cabeça ou acenam com o braço.

### Trocar ou adicionar modelos

1. **Baixe o modelo** em `.glb`.
   - **Mixamo:** escolha o personagem, clique em *Download*, formato *FBX Binary*, *With Skin*. Converta para `.glb` (por exemplo, no Blender: *File → Import → FBX* e depois *File → Export → glTF 2.0 (.glb)*).
   - **Sketchfab ou Poly Pizza:** baixe direto em *glTF / GLB*. Confira se a licença é CC0 ou CC-BY e anote o autor para os créditos.
2. **Copie o `.glb`** para `assets/modelos/originais/`.
3. **Gere a versão embutida** abrindo `ferramentas/embutir-modelo.html` no navegador. Escolha o `.glb` e salve o `.js` gerado em `assets/modelos/js/`. Quem tiver Node.js pode rodar `node ferramentas/embutir-modelos.js`, que converte todos de uma vez.
4. **Atualize `CT.MODELOS`** em `js/data.js` com o nome do arquivo, por exemplo `masculino: { arquivo: "remy.glb", ... }`.

Personagens do Mixamo usam o mesmo esqueleto, então recebem automaticamente as animações já existentes. Para dar a um NPC o modelo masculino ou o feminino, altere o campo `modelo` dele em `CT.PREDIOS`.

Se um arquivo de modelo faltar ou estiver com defeito, o jogo não trava. Ele usa os personagens provisórios desenhados em código e os objetos simples da versão anterior.

## Como alterar perguntas e textos

**Todo o conteúdo está em um único arquivo: `js/data.js`.** Abra-o no Bloco de Notas ou no VS Code. Não é preciso mexer no resto do código.

Em cada prédio é possível alterar:

- `nome`, `cor`: nome e cor da fachada;
- `npc`: nome, cargo e aparência do personagem;
- `curiosidade`: lista de falas (cada item é uma "página" do diálogo);
- `baseLegal`: referência da lei mostrada no diálogo;
- `pergunta` e `alternativas`: **sempre 4 alternativas**;
- `correta`: **número da alternativa certa: 0 = A, 1 = B, 2 = C, 3 = D**;
- `explicacao`: texto mostrado quando o jogador erra;
- `mensagemAcerto`: texto mostrado quando ele acerta.

Também ficam em `data.js`:

- `CT.CONFIG`: nome do órgão, data do evento, pontos por acerto, velocidade do personagem, sombras e duração das transições de tempo;
- `CT.TEMPO` e `CT.CLIMAS`: sequência de horários, estações e climas;
- `CT.MODELOS`: modelos 3D usados; `CT.PERSONAGENS`: as 5 personagens jogáveis;
- `CT.BOSS`: falas do chefe final e a lista `perguntas`. Cada pergunta tem `pergunta`, 4 `alternativas`, `correta`, `explicacoesErro` (na ordem das alternativas erradas) e `falaDano` (o que o chefe diz ao levar o golpe). A vida do chefe é igual ao número de perguntas, então dá para usar 2, 3, 4 ou mais;
- `CT.FINAL`: título e mensagem da tela de vitória.

Depois de salvar, basta recarregar a página (F5).

**Cuidado ao editar:** mantenha as aspas `"` e as vírgulas no lugar. Se a tela inicial não carregar depois de uma alteração, provavelmente faltou uma aspa ou vírgula.

## Logotipos

Os logos oficiais ficam em `assets/logos/`:

| Arquivo | Onde aparece |
|---|---|
| `cgm.png` | Rodapé do menu principal, tela de vitória e outdoors da cidade |
| `prefeitura-jaboatao.png` | Rodapé do menu principal, tela de vitória e outdoors da cidade |
| `cri.png` | Rodapé do menu principal, tela de vitória e outdoors da cidade |
| `ctrl-lab.png` | Abertura, rodapé do menu principal, tela de vitória (último, ao lado do CRI) e outdoors da cidade |

Os logos aparecem sobre placas brancas, para manter as cores originais legíveis sobre o fundo escuro.

### Outdoors na cidade

Há **14 outdoors** no alto dos prédios que cercam os bairros, de preferência no fim das ruas (quem anda pela rua vê o outdoor de frente, lá no alto). Cada um mostra um logo, ou os quatro juntos, sobre fundo branco; nas fileiras internas o outdoor tem duas faces. À noite eles acendem junto com as janelas. A quantidade e a ordem dos logos ficam em `CT.OUTDOORS`, no arquivo `js/data.js`.

Para os logos virarem textura mesmo com o jogo aberto direto do computador, eles também ficam embutidos em `assets/logos/js/logos.js`. **Se trocar algum PNG**, rode `node ferramentas/embutir-modelos.js` para atualizar esse arquivo.

**Para trocar ou acrescentar um logo**, substitua o arquivo PNG (de preferência com fundo transparente) ou edite `logoImagem` e `logosApoio` em `CT.CONFIG`, no arquivo `js/data.js`. A ordem no rodapé é a ordem dessa lista, e o `id` de cada logo permite ajustar o tamanho dele no CSS (classe `logo-<id>`).

## Prédio 1: a sede da Prefeitura do Jaboatão

O prédio 1 (Portal da Transparência) é um modelo da sede da Prefeitura do Jaboatão dos Guararapes, feito por código a partir de uma foto da fachada (`ferramentas/prefeitura/foto-prefeitura.jpg`). O modelo fica no arquivo `js/prefeitura.js` e é ativado por `modelo3d: "prefeitura"` no primeiro item de `CT.PREDIOS` (`js/data.js`).

- **Fachada:** prédio longo e baixo, com painéis azuis e o telhado de fibrocimento aparecendo por trás.
- **Lado esquerdo:** pano de vidro alto e canteiro com palmeiras e dracenas.
- **Entrada:** vidro com marquise, vasos de planta, patamar, escada com corrimãos de inox e rampa com guarda-corpo branco.
- **Lado direito:** duas janelas e o logo da Prefeitura, feito a partir de `assets/logos/prefeitura-jaboatao.png`, com o coração contornado de branco e as letras brancas.
- **Bandeiras:** três mastros com as bandeiras de Pernambuco, do Brasil e do Jaboatão, nessa ordem para quem olha a fachada, balançando ao vento. Elas são desenhadas por código em `js/prefeitura.js` (trecho `FLAG`).
- **Placa:** uma placa com o número 1 junto à calçada ajuda a localizar o prédio.

## Servidores dos prédios: olhar e gestos

- **Olhar:** dentro dos prédios, o servidor acompanha o jogador: em pé, vira o corpo para ele (até cerca de 70° para cada lado); sentado (o Prefeito), vira a cabeça e um pouco o tronco (`api.update` em `js/interiors.js` e `ch.olharPara` em `js/models.js`).
- **Gestos sem acúmulo:** os ossos mexidos por código (cabeça, tronco, braços, mãos e pernas) voltam à pose de repouso antes de cada quadro. Antes, nos homens (modelo Worker, cujo "parado" não anima a cabeça), o "não" com a cabeça se somava a cada quadro e a cabeça girava para posições impossíveis.
- **Aceno:** a mão fica aberta com a palma para a frente também nos modelos sem ossos de dedos (o Worker).

## Área secreta: a Casa de Festas

Uma das lojas da cidade (no lugar da antiga "Papelaria") é a **Casa de Festas**: dá para entrar, mas ela não tem missão, por isso não tem o anel de chegada nem a seta apontando para ela. A única pista são os cachos de balões na fachada; quem chega à porta vê "PRESSIONE ESPAÇO PARA ENTRAR NA CASA DE FESTAS".

- **O salão** (`js/casa-festas.js`):
  - pista de dança 7×7 com ladrilhos que acendem no ritmo da música;
  - globo espelhado girando e três refletores coloridos que varrem a pista;
  - letreiro com lâmpadas piscando e bandeirinhas no teto;
  - balões nos cantos e flutuando;
  - mesa com bolo de três andares (velinhas acesas), docinhos e copos;
  - presentes, duas caixas de som que "batem" com a música e confete caindo sem parar.
- **O dinossauro:** uma pessoa com fantasia inflável de tiranossauro rex, laranja com listras marrons nas costas, na cabeça e na cauda (aparecem os tênis de quem está dentro). Ele dança no meio da pista: pula no ritmo, balança o corpo, mexe a cabeça, abre a boca, sacode os bracinhos, abana a cauda, dá passinhos e, a cada 16 batidas, uma voltinha completa.
- **Os convidados:** sete pessoas em volta da pista, de frente para o dinossauro, dançando a mesma coreografia que ele e no mesmo compasso (modo `dance`, feito por código em `js/models.js`, com o relógio do dinossauro): pulinhos, corpo balançando, passinhos, bracinhos de tiranossauro e a voltinha a cada 16 batidas. Metade usa chapéu de festa. (O modo `clap`, de bater palmas, continua disponível.)
- **Dançar junto:** perto do dinossauro aparece "PRESSIONE ESPAÇO PARA DANÇAR COM O DINOSSAURO"; o personagem vira para ele e dança a mesma coreografia. ESPAÇO de novo, ou andar, faz parar.
- **A parede da entrada:** porta dupla roxa com batente dourado, placa luminosa de SAÍDA e balões; a câmera fica sempre do lado de dentro.
- **Música:** ao entrar toca a música enviada pela equipe, `assets/audio/festa.mp3` (`CT.CONFIG.musicas.festa`; ainda sem crédito, a pedido da equipe). Ao sair, volta a música da cidade. A dança e as luzes seguem o andamento da música (120 batidas por minuto, `BPM` em `js/casa-festas.js`).
- **Para sair:** volte até a porta (tapete "SAÍDA") e aperte ESPAÇO.

## Prédio 3: a Ouvidoria Geral

O prédio 3 (Ouvidoria) é um modelo da Ouvidoria Geral do Jaboatão dos Guararapes, feito por código a partir de uma foto da fachada (`ferramentas/ouvidoria/foto-ouvidoria.jpg`). O modelo fica no arquivo `js/ouvidoria.js` e é ativado por `modelo3d: "ouvidoria"` no item da Ouvidoria em `CT.PREDIOS` (`js/data.js`). A pessoa e a escada de alumínio que aparecem na foto ficaram de fora. As medidas saíram da foto (porta de cerca de 0,9 m × 2,1 m) e tudo foi ampliado 1,8× para combinar com a escala dos outros prédios.

- **Fachada:** prédio térreo de paredes brancas, com escorridos e sujeira perto do chão, e a platibanda azul com um pequeno beiral.
- **Letreiro luminoso:** "OUVIDORIA GERAL" com o logo da Prefeitura (coração em cima e o nome embaixo, a partir de `assets/logos/prefeitura-jaboatao.png`), o filete verde e a faixa de formas coloridas no canto; desenhado em canvas e aceso também à noite. Embaixo, a luminária fluorescente.
- **Porta:** porta de vidro com o cartaz "Ouvidoria — Queremos ouvir você!", recortado da própria foto (`assets/texturas/ouvidoria-porta.jpg`). Ao lado, a grade de ferro aberta encostada na parede.
- **Entrada:** tapete preto, canteiros de cascalho com espadas-de-são-jorge (meio-fio azul à esquerda), patamar e escadaria de concreto gasto.
- **Placa:** uma placa com o número 3 junto à calçada ajuda a localizar o prédio.

Para a textura funcionar mesmo com o jogo aberto direto do computador, ela também fica embutida em `assets/texturas/js/texturas.js`. Se trocar a foto, rode `python3 ferramentas/ouvidoria/gerar_texturas.py` para refazer o recorte e esse arquivo.

## O Prefeito

O **Prefeito** (modelo `prefeito`, feito a partir do desenho da equipe) é quem atende no prédio 1 (Portal da Transparência), no lugar da Ana Clara. Em vez do balcão, a sala dele tem uma **mesa de gabinete** de madeira escura (`mesaChefe` em `js/interiors.js`, ligada pelo campo `mesaChefe: true` do `npc`): tampo com couro verde, placa de latão na frente com “Prefeito - Portal da Transparência” (campo `placa`), plaquinha “PREFEITO”, luminária de cúpula verde, globo que gira, porta-canetas, pastas, xícara de café, porta-retrato e mini bandeiras do Brasil e de Pernambuco; atrás, cadeira de couro de espaldar alto. Ele fica **sentado** (`npc.sentado`, pose montada em `js/models.js`: quadril baixa até o assento, coxas para a frente, canelas na vertical e antebraços apoiados na mesa); a altura do assento vem das medidas do próprio modelo. Os campos `chamado` (“o Prefeito”) e `local` (“na mesa dele”) são usados nos avisos, como “Converse com o Prefeito na mesa dele”.

## Seu Lima, o guarda do pórtico

Logo no início, ao lado do pórtico "Bem-vindo à Jornada da Transparência", fica o **Seu Lima**, guarda municipal. Ele se vira para o jogador e acena de tempos em tempos, com a mão aberta, como na vida real (o mesmo aceno vale para todos os personagens que acenam no jogo). Chegando perto dele e apertando **ESPAÇO**, ele bate continência e recebe o jogador com um "Bom dia, meu comandante!" ou "Bom dia, minha comandante!" (e "bem-vindo" ou "bem-vinda"), conforme o personagem escolhido e conta, em cinco falas, a história do jogo: o Corrupson, os 8 prédios, os portões, o ranking e a Torre da Transparência. Uma **exclamação amarela flutuante** acima da cabeça dele indica que dá para conversar; ela some durante a conversa e volta depois. Conversar com ele é opcional e não conta tempo de pergunta. As falas ficam em `CT.SEU_LIMA`, no arquivo `js/data.js`.

## Corrupson, o chefe final

O **Corrupson**, monstro peludo criado a partir de um desenho da equipe, é o chefe final e espera o jogador na Torre da Transparência. Ele tem cerca de 5 m de altura (o dobro da primeira versão; ajuste em `altura` do modelo `corrupson`, no arquivo `js/data.js`) e se mexe com gestos próprios, feitos por código sobre as animações do RobotExpressive: **furioso**, pula e sacode os braços acima da cabeça (a cada três pulos, uma pausa batendo os punhos no ar); quando o jogador **erra**, comemora pulando, socando o ar e rebolando de deboche; quando o jogador **acerta**, sente o golpe (tranco para trás, braços para o alto, cabeça tombada) e depois balança a cabeça dizendo "não". No último acerto, cai derrotado e vira fumaça. Os gestos ficam em `bossGestures`, no arquivo `js/models.js` (ativados por `gestosChefe: true` no modelo). O nome e as falas ficam em `CT.BOSS`, no arquivo `js/data.js`.

## Abertura

Antes do menu principal aparece uma abertura: tela branca em que o logo do Ctrl Lab surge aos poucos (do desfocado para o nítido), com **Games Institucionais** logo abaixo, nas cores do logo ("Games" no amarelo da lâmpada e "Institucionais" no azul). Ela acompanha o efeito sonoro “Intro”, de DarioCoiro (Pixabay, uso gratuito), dura cerca de 6 segundos e depois revela o menu, onde a música tema começa sozinha. O carregamento da cidade continua por trás durante a abertura.

- **Pular:** tecla **ESPAÇO** (não há aviso na tela). Durante a abertura, as outras teclas e cliques não chegam ao menu.
- **Som bloqueado pelo navegador:** navegadores só deixam uma página tocar som depois de um clique ou tecla. Quando o navegador bloqueia, a tela branca mostra apenas "Clique ou pressione qualquer tecla para começar"; esse primeiro gesto inicia a abertura já com som e libera a música do menu em seguida. Num totem, dá para evitar esse passo abrindo o Chrome com a opção `--autoplay-policy=no-user-gesture-required` (por exemplo, num atalho junto com `--kiosk`).
- **Ajustes:** `abertura` em `CT.CONFIG` (`js/data.js`): ligar/desligar (`ativa`), arquivo do som, volume e duração. Visual em `css/style.css` (seção ABERTURA) e lógica em `js/intro.js`.

## Músicas

O jogo tem três músicas, todas gratuitas e de uso livre. Só uma toca por vez, com transição suave entre elas.

| Momento | Música | Licença |
|---|---|---|
| Tela inicial | “16-bit Relationship”, de Yoshiyuki Tatsuya | Pixabay (uso gratuito) |
| Cidade e prédios | “City Sunshine”, de Kevin MacLeod | FreePD, domínio público (CC0) |
| Batalha contra o Corrupson | “Kings Trailer”, de Rafael Krux | FreePD, domínio público (CC0) |

- A música da cidade toca **baixinho**, ao fundo, e **não é interrompida** por diálogos nem ao entrar e sair dos prédios.
- Ao enfrentar o Corrupson, ela dá lugar à música épica. Se o jogador sair da batalha antes de vencer, a música da cidade volta. Na vitória, a música para durante a fanfarra e a música da cidade volta na tela de resultado.
- A música do menu começa quando a abertura termina. Os navegadores não deixam uma página tocar som antes de alguma interação; se for o caso, a própria abertura pede um clique ou tecla (veja **Abertura**).
- **Ligar e desligar:** o botão no canto superior direito da tela inicial e a opção **MÚSICA** do menu de pausa (ESC) ligam e desligam só as músicas. O navegador lembra a escolha. O botão de som do jogo silencia tudo.
- **Para trocar uma música ou ajustar o volume:** coloque o `.mp3` em `assets/audio/` e edite `musicas` em `CT.CONFIG` (`js/data.js`): arquivo, título, autor e volume (0 a 1). Lembre de atualizar também `CT.CREDITOS`.
- Origem e licença de cada faixa: `assets/audio/LICENCAS-MUSICAS.txt`.

## Estrutura do projeto

```
jornada-transparencia/
├── index.html          página principal
├── LEIA-ME.md          este arquivo
├── css/
│   ├── style.css       visual da interface
│   └── fonts.css       fontes locais
├── fonts/              fontes Bricolage Grotesque e Figtree (licença OFL)
├── vendor/
│   ├── three.min.js    biblioteca Three.js r147 (licença MIT)
│   ├── GLTFLoader.js   leitor de modelos .glb (Three.js)
│   └── SkeletonUtils.js cópia de personagens com esqueleto (Three.js)
├── ferramentas/
│   ├── embutir-modelo.html  converte .glb em .js (no navegador)
│   ├── embutir-modelos.js   mesma coisa, via Node.js (e embute os logos dos outdoors)
│   └── personagem-desenho/  scripts que geraram Ana, Helena, Caio, Paulo, Luana, Lorena, o Prefeito, Seu Antônio e Seu Lima a partir dos desenhos e da foto
├── assets/
│   ├── audio/      músicas e som da abertura (MP3) e as licenças deles
│   ├── logos/      logos da Prefeitura, da CGM, do CRI e do Ctrl Lab (e js/logos.js, embutidos)
│   ├── texturas/   recortes de fotos usados como textura (e js/texturas.js, embutidos)
│   └── modelos/
│       ├── originais/  arquivos .glb (personagens e objetos)
│       └── js/         os mesmos modelos embutidos em .js
└── js/
    ├── data.js         CONTEÚDO: perguntas, personagens, textos, configurações
    ├── utils.js        texturas, colisões, sons sintetizados
    ├── intro.js        abertura (logo do Ctrl Lab + Games Institucionais) antes do menu
    ├── characters.js   fábricas de personagens + substitutos provisórios
    ├── models.js       carrega os .glb, redireciona animações, recolore roupas
    ├── atmosphere.js   tempo, estações, clima, chuva, noite
    ├── world.js        cidade, prédios, portões e torre do chefe final
    ├── interiors.js    ambientes internos de cada prédio
    ├── ranking.js      ranking das partidas (Firebase ou navegador)
    ├── touch.js        controles de toque (celular e tablet) e troca automática
    ├── ui.js           painel, minimapa, diálogos e tela de vitória
    └── game.js         lógica do jogo: estados, progressão, câmera
```

## Ranking compartilhado (Firebase)

Configuração feita uma vez, em uns 10 minutos, com uma conta Google. O plano gratuito (Spark) atende com folga e não pede cartão.

1. Acesse <https://console.firebase.google.com>, clique em **Criar um projeto**, dê um nome (ex.: `jornada-transparencia`) e conclua. O Google Analytics pode ficar desativado.
2. No menu **Criação → Firestore Database**, clique em **Criar banco de dados**. Escolha a região `southamerica-east1 (São Paulo)` e o **modo de produção**.
3. Na aba **Regras** do Firestore, apague o conteúdo, cole o arquivo [`firestore.rules`](firestore.rules) inteiro e clique em **Publicar**. As regras deixam qualquer jogador ler o ranking e registrar partidas com dados plausíveis, mas ninguém altera nem apaga nada pelo jogo.
4. Na página inicial do projeto, clique no ícone **Web** (`</>`) para registrar um app (nome livre; não marque Hosting). Aparece um bloco `firebaseConfig`.
5. Copie `apiKey`, `authDomain`, `projectId` e `appId` desse bloco para `rankingOnline.firebase` em `js/data.js` e publique o jogo de novo no GitHub Pages.

A `apiKey` do Firebase não é uma senha: ela só identifica o projeto e pode ficar no código público. Quem protege os dados são as regras do passo 3.

- **Testes e dia do evento:** o nome da lista fica em `rankingOnline.colecao` (hoje `ranking-evento`). Para testar sem sujar o ranking do evento, use `ranking-teste` e, antes do evento, volte para `ranking-evento` (ou use outro nome começando com `ranking`). Cada nome é um ranking separado.
- **Apagar partidas:** pelo console do Firebase, em **Firestore Database → Dados**, apague uma partida ou a coleção inteira.
- **Abrindo o `index.html` direto do computador:** o ranking compartilhado também funciona, desde que haja internet. Sem internet, a partida fica guardada e é enviada depois.
- Se o Firebase não carregar ou não estiver configurado, o jogo usa o ranking local automaticamente.

## Dicas para o evento

- **Desempenho:** em computadores mais simples, troque `sombras: true` por `sombras: false` em `js/data.js`. O ganho é grande. A chuva e as folhas são processadas pela placa de vídeo e foram limitadas para não pesar.
- **Carregamento:** na primeira abertura, o botão mostra "CARREGANDO MODELOS 3D…" por alguns segundos.
- **Som:** os efeitos sonoros são gerados pelo próprio navegador. O botão no canto inferior direito liga e desliga o som. Se o navegador bloquear o som, a abertura pede um clique ou tecla; num totem, clique uma vez na tela antes de deixar o jogo para o público (ou use a opção do Chrome descrita em **Abertura**).
- **Mouse e ponteiro:** na cidade e dentro dos prédios, o ponteiro do mouse fica escondido e preso à tela. Mover o mouse para os lados gira a personagem e a câmera acompanha por trás; mover para cima ou para baixo inclina o olhar: dá para olhar livremente para o céu (a câmera desce atrás da personagem e a vista fica livre para o alto) ou para o chão. Dentro dos prédios a câmera funciona igual (livre, com zoom na roda do mouse e C para recentrar), sem atravessar as paredes nem o teto da sala. Ele volta a aparecer nos diálogos, no mapa e nas telas com botões. Se a câmera não responder ao mouse, clique uma vez na tela do jogo. A tecla ESC também solta o ponteiro; isso é padrão do navegador. A sensibilidade fica em `CT.CONFIG.sensibilidadeMouse`.
- **Passos:** os passos da protagonista acompanham a animação, pela altura dos pés. O som muda conforme o piso: asfalto, calçada, grama, chão interno com leve eco, ou respingos quando a rua está molhada.
- **Reiniciar para o próximo participante:** depois de registrar o nome, clique em **JOGAR NOVAMENTE** ou **TELA INICIAL**. No meio da partida, aperte **ESC → SAIR DO JOGO**; o jogo pede confirmação e leva à tela de resultado para registrar o nome. Recarregar a página (F5) também reinicia, mas a partida em andamento não é registrada.
- **Ranking:** com o ranking compartilhado, confira antes do evento se a janela do ranking mostra "● ao vivo" em cada aparelho. No modo local, use sempre o mesmo computador e o mesmo navegador, fora da janela anônima. Ao fim do evento, exporte a planilha pelo botão **EXPORTAR PLANILHA (CSV)**.
- **Atalhos para a equipe** (abra o console do navegador com F12):
  - `CT.debug.concluirProximo()` conclui a etapa atual e abre o portão;
  - `CT.debug.irPara(3)` leva o personagem até a porta do prédio 4 (a contagem começa em 0; `irPara(8)` leva ao chefe final).

## Créditos técnicos

- Renderização 3D: [Three.js](https://threejs.org) r147 (MIT), com GLTFLoader e SkeletonUtils.
- Personagens: Michelle e X Bot, do [Mixamo](https://www.mixamo.com) (Adobe); avatares [Ready Player Me](https://readyplayer.me) (CC 4.0, uso não comercial); Ana, Helena, Caio, Paulo, Luana, Lorena, o Prefeito e Seu Antônio, adaptados a partir de desenhos da equipe; Worker e Adventurer, de [Quaternius](https://quaternius.com) (CC0).
- Chefe final: RobotExpressive, de Tomás Laulhé (CC0).
- Objetos urbanos: [KayKit City Builder Bits](https://kaylousberg.com), de Kay Lousberg (CC0).
- Fontes: Bricolage Grotesque e Figtree (SIL Open Font License).
- Músicas: “16-bit Relationship”, de Yoshiyuki Tatsuya (Pixabay, uso gratuito); “City Sunshine”, de Kevin MacLeod, e “Kings Trailer”, de Rafael Krux (FreePD, domínio público CC0).
- **Todos os recursos de terceiros (músicas, modelos, fontes e bibliotecas) são gratuitos e de uso livre**, em domínio público (CC0) ou sob licenças abertas e gratuitas (MIT, SIL OFL, Mixamo/Adobe, Ready Player Me para uso não comercial, Pixabay).
- Prédios temáticos, interiores, céu, chuva, texturas e efeitos sonoros são gerados por código.
