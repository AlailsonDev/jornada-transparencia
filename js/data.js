/* =====================================================================
 * A JORNADA DA TRANSPARÊNCIA — CONTEÚDO DO JOGO
 * ---------------------------------------------------------------------
 * Este arquivo concentra TODO o conteúdo editável do jogo:
 *   - configurações gerais (nome do órgão, pontuação, velocidade...)
 *   - prédios (ordem da jornada, cores, NPCs, curiosidades, perguntas)
 *   - chefe final (boss)
 *   - textos da tela inicial e da tela de vitória
 *
 * Para alterar perguntas ou textos NÃO é preciso mexer na lógica do jogo.
 * Regras importantes ao editar:
 *   - cada pergunta deve ter exatamente 4 alternativas (A, B, C, D);
 *   - "correta" é o ÍNDICE da alternativa certa: 0 = A, 1 = B, 2 = C, 3 = D;
 *   - a ORDEM do array PREDIOS é a ordem obrigatória da jornada;
 *   - cores no formato hexadecimal (ex.: "#1E6FD9").
 * ===================================================================== */

window.CT = window.CT || {};

/* ---------------------------------------------------------------------
 * CONFIGURAÇÕES GERAIS
 * ------------------------------------------------------------------- */
CT.CONFIG = {
  titulo: "A Jornada da Transparência",
  chamada:
    "Explore a cidade, descubra curiosidades, responda aos desafios e prove que você conhece a importância da transparência pública!",
  orgao: "Controladoria Geral do Município",
  orgaoSigla: "CGM",
  evento: "Dia da Transparência",
  dataEvento: "18 de novembro",

  // Logotipo oficial (opcional). Ex.: "assets/logo-cgm.png".
  // Se ficar vazio, o jogo usa o emblema padrão desenhado em código.
  logoImagem: "assets/logos/cgm.png",
  // Logos exibidos no rodapé do menu principal e na tela de vitória
  logosApoio: [
    { id: "prefeitura-jaboatao", arquivo: "assets/logos/prefeitura-jaboatao.png", nome: "Prefeitura do Jaboatão dos Guararapes" },
    { id: "cgm", arquivo: "assets/logos/cgm.png", nome: "Controladoria Geral do Município" },
    { id: "cri", arquivo: "assets/logos/cri.png", nome: "CRI – Comitê de Relações Institucionais" },
    { id: "ctrl-lab", arquivo: "assets/logos/ctrl-lab.png", nome: "Ctrl Lab – Inovação em Controle" },
  ],

  // Trilha sonora (MP3 em assets/audio/). Só uma música toca por vez,
  // com transição suave entre elas. Para trocar uma faixa, coloque outro
  // .mp3 em assets/audio/ e ajuste o arquivo, o título e o autor aqui.
  // Volume de 0 a 1. Deixe arquivo: "" para desativar uma das músicas.
  // Abertura antes do menu: tela branca com o logo do CRI e "Games Institucionais" surgindo,
  // com o efeito sonoro abaixo. ESPAÇO pula (sem aviso na tela).
  abertura: {
    ativa: true,
    som: "assets/audio/abertura-cri-games.mp3",
    volume: 0.85,
    duracao: 5.4,   // segundos até começar a sumir (o som tem ~5 s audíveis)
  },

  musicas: {
    menu: {    // tela inicial
      arquivo: "assets/audio/menu-16-bit-relationship.mp3",
      titulo: "16-bit Relationship", autor: "Yoshiyuki Tatsuya",
      volume: 0.35,
    },
    jogo: {    // fundo da cidade e dos prédios: baixinho e sem cortes
      arquivo: "assets/audio/jogo-city-sunshine.mp3",
      titulo: "City Sunshine", autor: "Kevin MacLeod",
      volume: 0.2,
    },
    festa: {   // Casa de Festas (área secreta): toca só lá dentro
      arquivo: "assets/audio/festa.mp3",
      volume: 0.5,
    },
    chefe: {   // batalha contra o chefe final
      arquivo: "assets/audio/chefe-kings-trailer.mp3",
      titulo: "Kings Trailer", autor: "Rafael Krux",
      volume: 0.55,
    },
  },

  // PONTUAÇÃO
  // Cada resposta certa vale pontosPorAcerto + um bônus de rapidez.
  // O tempo de resposta começa quando a caixa com a pergunta aparece e para
  // na resposta certa (respostas erradas fazem o tempo, e a perda, aumentar).
  // O bônus começa em bonusRapidez.maximo e, depois de bonusRapidez.carencia
  // segundos, cai bonusRapidez.perdaPorSegundo pontos a cada segundo.
  pontosPorAcerto: 100,
  // Bônus secreto da Casa de Festas (uma vez por partida): achar o CtrlDino e dançar com ele.
  // Se mudar estes valores, ajuste também o limite em firestore.rules.
  bonusDino: { achar: 150, dancar: 50 },
  bonusRapidez: { maximo: 100, carencia: 5, perdaPorSegundo: 3 },

  // RANKING COMPARTILHADO (Firebase Firestore)
  // Com os dados do projeto Firebase preenchidos, todos os aparelhos (PC,
  // celular, tablet) gravam e leem o mesmo ranking, atualizado ao vivo.
  // Deixe apiKey vazio para usar o ranking só neste navegador, como antes.
  // colecao: nome da lista no Firestore; precisa começar com "ranking".
  // Troque o nome (ex.: "ranking-teste" → "ranking-evento") para começar
  // um ranking novo, sem as partidas de teste.
  rankingOnline: {
    firebase: {
      apiKey: "AIzaSyC9DN0_LcyuuSJbYoC-aBy_UdeMQXCccFQ",
      authDomain: "jornada-transparencia.firebaseapp.com",
      projectId: "jornada-transparencia",
      appId: "1:467174166175:web:4a4b40ea114da350129caa",
    },
    colecao: "ranking-evento",
  },

  velocidadeCaminhada: 7.5,  // unidades por segundo
  velocidadeCorrida: 13,     // com SHIFT pressionado
  velocidadeGiro: 2.7,       // radianos por segundo
  pulo: { forca: 7.5, gravidade: 24 }, // ESPAÇO: impulso e gravidade (altura ≈ forca² / (2 × gravidade) ≈ 1,2 m)
  sensibilidadeMouse: 0.0028, // giro da câmera ao mover o mouse

  sombras: true,             // desative em computadores mais fracos
  pixelRatioMaximo: 1.75,
  // a resolução cai sozinha se o aparelho não der conta (e volta a subir quando dá)
  resolucaoAdaptativa: true,

  // CELULARES E TABLETS: estes valores substituem os de cima nesses aparelhos
  celular: {
    sombras: false,          // o maior ganho de desempenho
    pixelRatioMaximo: 1.25,
    sensibilidadeToque: 0.006, // giro da câmera ao arrastar o dedo
  },
};

/* ---------------------------------------------------------------------
 * PRÉDIOS DA JORNADA (na ordem obrigatória)
 * Campos:
 *   id, nome, nomeCurto, cor (fachada), destaque (detalhes),
 *   decoracao (tipo de ambiente interno: portal | lai | ouvidoria |
 *              controle | lgpd | licitacoes | obras | dados),
 *   npc { nome, cargo, pele, cabelo, estiloCabelo, camisa, calca, acessorio }
 *   curiosidade [páginas de texto], baseLegal,
 *   pergunta, alternativas[4], correta (0-3),
 *   explicacao (mostrada ao errar), mensagemAcerto (mostrada ao acertar)
 * ------------------------------------------------------------------- */
CT.PREDIOS = [
  {
    id: "portal",
    nome: "Portal da Transparência",
    nomeCurto: "Portal",
    cor: "#1E6FD9",
    destaque: "#FFC83D",
    decoracao: "portal",
    modelo3d: "prefeitura", // sede da Prefeitura do Jaboatão (js/prefeitura.js), com as bandeiras de PE, do Brasil e do Jaboatão
    npc: {
      nome: "Prefeito", chamado: "o Prefeito", modelo: "prefeito",
      cargo: "Prefeito do Jaboatão dos Guararapes",
      placa: "Prefeito - Portal da Transparência", mesaChefe: true, local: "na mesa dele" },
    curiosidade: [
      "Olá! Que bom ter você por aqui! Você sabia que existe um lugar onde qualquer pessoa pode descobrir como o dinheiro da cidade é arrecadado e utilizado?\n\nEsse lugar é o Portal da Transparência!\n\nNele, podemos consultar receitas, despesas, contratos, compras e até acompanhar as obras municipais.\n\nE o melhor: qualquer pessoa pode acessar, sem precisar de senha ou cadastro!",
      "E sabe por que essas informações precisam estar disponíveis?\n\nPorque a transparência é um direito de todos! Desde 2009, existe uma lei chamada Lei da Transparência, que obriga os governos a divulgar pela internet informações sobre o uso do dinheiro público.\n\nAssim, todo mundo pode acompanhar como o dinheiro da cidade está sendo utilizado!",
    ],
    baseLegal: "Lei Complementar nº 131/2009 · Decreto Federal nº 10.540/2020.",
    pergunta:
      "Você prestou atenção? Qual é o nome da lei que obriga os governos a divulgar informações sobre como o dinheiro público é utilizado?",
    alternativas: [
      "Lei do Dinheiro Público.",
      "Lei da Transparência.",
      "Lei do Município.",
      "Lei do Orçamento Anual.",
    ],
    correta: 1,
    explicacao:
      "Quase lá! A resposta certa é Lei da Transparência! Ela foi criada em 2009 e determina que os governos divulguem informações sobre receitas e despesas públicas pela internet. Assim, qualquer pessoa pode acompanhar como o dinheiro público é utilizado!",
    mensagemAcerto:
      "Isso mesmo! Você acertou! A Lei da Transparência ajuda todo mundo a acompanhar como o dinheiro público é utilizado. Afinal, informação não é segredo: é direito de todos!",
    falaConcluido:
      "Muito bem! Você já descobriu a importância do Portal da Transparência. Continue sua missão: a próxima estação está esperando por você!",
  },
  {
    id: "lai",
    nome: "Acesso à Informação",
    nomeCurto: "LAI",
    cor: "#0E9F8E",
    destaque: "#E9F7F4",
    decoracao: "lai",
    npc: {
      nome: "Roberto", modelo: "masculino",
      cargo: "Atendente do SIC (Serviço de Informação ao Cidadão)",
      pele: "#7A4A2E", cabelo: "#141414", estiloCabelo: "curto",
      camisa: "#0E9F8E", calca: "#2F3B4F", acessorio: "cracha", altura: 1.82, corpo: 1.06 },
    curiosidade: [
      "Olá! Seja bem-vindo! Eu sou o Roberto e trabalho no Serviço de Informação ao Cidadão, o SIC.\n\nVocê sabia que qualquer pessoa pode pedir informações aos órgãos públicos?\n\nÉ isso mesmo! Se quiser saber alguma coisa sobre os serviços, projetos ou ações da Prefeitura, você pode fazer um pedido de informação!",
      "E tem mais uma coisa importante: você não precisa explicar por que deseja acessar uma informação!\n\nEsse direito é garantido pela Lei de Acesso à Informação (Lei nº 12.527/2011). E atenção aos prazos: o governo tem até 20 dias para responder ao seu pedido. Se precisar de mais tempo, esse prazo pode ser prorrogado por mais 10 dias, desde que a prorrogação seja justificada.\n\nViu só? Perguntar é um direito de todos. E exercer esse direito ajuda a construir uma cidade mais transparente!",
    ],
    baseLegal: "Lei nº 12.527/2011 – Lei de Acesso à Informação (LAI), artigos 10 e 11.",
    pergunta:
      "Agora quero ver se você aprendeu! Quando alguém faz um pedido de informação ao governo, qual é o prazo para receber uma resposta?",
    alternativas: [
      "Até 5 dias, sem nenhuma possibilidade de prorrogação, mesmo com justificativa.",
      "Até 60 dias corridos, contados a partir da data em que o pedido foi feito.",
      "Até 20 dias, podendo ser prorrogado por mais 10 dias, com justificativa.",
      "Não existe prazo: o governo responde quando tiver tempo e disponibilidade.",
    ],
    correta: 2,
    explicacao:
      "Não foi dessa vez! Mas vou te dar uma dica: a Lei de Acesso à Informação determina que o governo deve responder em até 20 dias. Se precisar de mais tempo, pode ganhar mais 10 dias, mas precisa explicar o motivo. E lembre-se: ninguém precisa justificar por que deseja uma informação!",
    mensagemAcerto:
      "Muito bem! Você acertou! Saber é um direito, perguntar também! E o governo tem prazo para responder!",
    falaConcluido:
      "Parabéns novamente! Você já sabe que pedir informações é um direito de todos. Continue sua missão: a próxima estação espera por você!",
  },
  {
    id: "ouvidoria",
    nome: "Ouvidoria",
    nomeCurto: "Ouvidoria",
    cor: "#E2574C",
    destaque: "#FFE3DC",
    decoracao: "ouvidoria",
    modelo3d: "ouvidoria", // Ouvidoria Geral do Jaboatão, modelada a partir da foto da fachada (js/ouvidoria.js)
    npc: {
      nome: "Lorena", modelo: "lorena",
      cargo: "Ouvidora do Município" },
    curiosidade: [
      "Olá! Eu sou Lorena e trabalho na Ouvidoria do Município.\n\nVocê sabia que existe um lugar onde as pessoas podem dar opiniões, fazer reclamações, contar quando algo não está certo e até elogiar um serviço da Prefeitura? Esse lugar é a Ouvidoria!\n\nEla é um espaço onde a voz da população é ouvida e pode ajudar a melhorar a cidade!",
      "Aqui você pode registrar reclamações, denúncias, sugestões, elogios e solicitações de providências e a Prefeitura tem até 30 dias para responder à sua manifestação.\n\nE tem mais: seus dados pessoais são protegidos, e ninguém pode divulgar sua identidade sem autorização, salvo nas situações previstas em lei.",
    ],
    baseLegal: "Lei nº 13.460/2017, arts. 10 e 16.",
    pergunta:
      "Quais tipos de manifestação podem ser registrados na Ouvidoria?",
    alternativas: [
      "Apenas denúncias anônimas contra servidores e secretários.",
      "Reclamações, denúncias, sugestões, elogios e solicitações.",
      "Somente reclamações feitas pessoalmente, com testemunhas.",
      "Apenas pedidos de emprego, de estágio e inscrições em concursos.",
    ],
    correta: 1,
    explicacao:
      "Poxa, não foi dessa vez! Mas vou te ajudar. A Ouvidoria recebe vários tipos de manifestação: reclamações, denúncias, sugestões, elogios e solicitações de providências. Tudo isso ajuda a melhorar os serviços públicos. E seus dados pessoais são protegidos!",
    mensagemAcerto:
      "Muito bem! Você acertou! E lembre-se: sua opinião importa! Reclamar, sugerir e até elogiar são formas de ajudar a cuidar da cidade!",
    falaConcluido:
      "Parabéns novamente! Você descobriu que toda voz merece ser ouvida. Continue sua missão: a próxima estação está esperando por você!",
  },
  {
    id: "controle",
    nome: "Controle Social",
    nomeCurto: "Controle Social",
    cor: "#7A4DD8",
    destaque: "#EFE7FF",
    decoracao: "controle",
    npc: {
      nome: "Seu Carlos", modelo: "masculino",
      cargo: "Conselheiro Municipal",
      pele: "#D9A07A", cabelo: "#E3E3E3", estiloCabelo: "calvo",
      camisa: "#7A4DD8", calca: "#4A4A55", acessorio: "bigode", altura: 1.7, corpo: 1.12 },
    curiosidade: [
      "Você sabe o que é controle social? É quando a população participa e ajuda a fiscalizar como a Prefeitura usa o dinheiro público.\n\nIsso pode acontecer de várias formas: participando dos conselhos de saúde e educação, indo a reuniões e audiências públicas e acompanhando como o dinheiro da cidade está sendo gasto.",
      "E olha que interessante! A Constituição Federal garante que, todos os anos, as contas da Prefeitura fiquem disponíveis para qualquer cidadão consultar.\n\nIsso mesmo! Qualquer pessoa pode olhar essas contas e até questionar se encontrar algo que não parece certo.",
    ],
    baseLegal: "Constituição Federal, art. 31, § 3º.",
    pergunta:
      "O que significa exercer o controle social?",
    alternativas: [
      "Participar e acompanhar como a Prefeitura utiliza o dinheiro público.",
      "Deixar toda a fiscalização dos gastos apenas nas mãos dos políticos.",
      "Decidir sozinho, sem consultar ninguém, como o dinheiro deve ser gasto.",
      "Cuidar apenas dos problemas da própria casa, sem se envolver com a cidade.",
    ],
    correta: 0,
    explicacao:
      "Poxa, não foi dessa vez! Mas vou te explicar: controle social é quando as pessoas participam e acompanham como o dinheiro público está sendo usado. Assim, todos podem ajudar a fiscalizar e melhorar a cidade!",
    mensagemAcerto:
      "Muito bem! Você acertou! Participar, acompanhar e fiscalizar o uso do dinheiro público são formas de exercer o controle social. Afinal, cuidar da cidade também é participar!",
    falaConcluido:
      "Parabéns de novo! Agora você sabe que todos podem ajudar a cuidar da cidade, acompanhando e fiscalizando o uso do dinheiro público. Continue sua missão: a próxima etapa já está esperando por você!",
  },
  {
    id: "lgpd",
    nome: "Proteção de Dados (LGPD)",
    nomeCurto: "LGPD",
    cor: "#2D3E8F",
    destaque: "#6FE3FF",
    decoracao: "lgpd",
    npc: {
      nome: "Dra. Beatriz", modelo: "feminino",
      cargo: "Encarregada de Dados",
      pele: "#F1C7A5", cabelo: "#6B3B1F", estiloCabelo: "rabo",
      camisa: "#2D3E8F", calca: "#1E2433", acessorio: "oculos", altura: 1.74, corpo: 0.94 },
    curiosidade: [
      "Você sabia que nem todas as nossas informações podem ser compartilhadas por aí?\n\nA Lei Geral de Proteção de Dados, conhecida como LGPD, protege as informações pessoais de cada pessoa, inclusive aquelas que a Prefeitura guarda.",
      "Por exemplo: seu nome, endereço e telefone são dados pessoais. Mas existem informações que precisam de ainda mais proteção, como dados sobre sua saúde, religião e características físicas ou biométricas.\n\nÉ como na escola: a lista com os nomes dos alunos pode ser usada para organizar a turma, mas ninguém deve sair divulgando o endereço ou as informações de saúde dos colegas!\n\nJá informações sobre os gastos da Prefeitura, como o valor de uma obra ou de um contrato, devem ser públicas. Afinal, todos têm o direito de saber como o dinheiro público está sendo utilizado.",
    ],
    baseLegal: "Lei nº 13.709/2018 (LGPD), art. 5º, II.",
    pergunta:
      "Qual destas informações é considerada um dado pessoal sensível pela LGPD?",
    alternativas: [
      "O valor gasto pela Prefeitura na construção de uma escola.",
      "A quantidade de alunos matriculados em uma escola.",
      "A informação sobre a saúde de um estudante.",
      "O nome de uma empresa que presta serviços à Prefeitura.",
    ],
    correta: 2,
    explicacao:
      "Não foi dessa vez! Mas vou te ajudar: informações sobre a saúde de uma pessoa são dados pessoais sensíveis e precisam de proteção especial. Isso significa que devem ser tratadas com muito cuidado e não podem ser divulgadas de qualquer maneira.",
    mensagemAcerto:
      "Muito bem! Você acertou! É importante saber o que pode ser divulgado e o que precisa ser protegido. Transparência nas informações públicas e respeito à privacidade das pessoas devem andar juntos!",
    falaConcluido:
      "Parabéns de novo! Agora você sabe que proteger os dados pessoais também é uma forma de respeitar as pessoas. Continue sua missão: a próxima etapa já está esperando por você!",
  },
  {
    id: "licitacoes",
    nome: "Licitações e Contratos",
    nomeCurto: "Licitações",
    cor: "#C9861A",
    destaque: "#FFF1D6",
    decoracao: "licitacoes",
    npc: {
      nome: "João", modelo: "masculino",
      cargo: "Agente de Contratação",
      pele: "#A86E4A", cabelo: "#2A2A2A", estiloCabelo: "curto",
      camisa: "#F4F4F4", calca: "#2E3A55", acessorio: null, altura: 1.84, corpo: 1.0 },
    curiosidade: [
      "Você sabia que a Prefeitura também precisa fazer compras para cuidar da cidade?\n\nEla compra materiais para as escolas, equipamentos para os hospitais, merenda escolar e muitos outros produtos e serviços.\n\nMas essas compras não podem ser feitas de qualquer jeito! Existem regras que garantem que as empresas tenham oportunidades iguais para participar e que o dinheiro público seja bem utilizado. Essas regras estão na Lei de Licitações (Lei nº 14.133/2021).",
      "E tem mais! Existe um site chamado Portal Nacional de Contratações Públicas, o PNCP.\n\nNele, qualquer pessoa pode consultar informações sobre as compras e contratações feitas pelos órgãos públicos, como editais, contratos e resultados das licitações.\n\nAssim, todos podem acompanhar como a Prefeitura escolhe as empresas e utiliza o dinheiro público!",
    ],
    baseLegal: "Lei nº 14.133/2021, art. 174.",
    pergunta:
      "Qual é o nome do site oficial onde podemos consultar informações sobre as compras e contratações públicas?",
    alternativas: [
      "Portal Nacional de Contratações Públicas (PNCP).",
      "Mural de avisos da recepção da Prefeitura.",
      "Perfil pessoal do prefeito nas redes sociais.",
      "Jornal escolhido pela empresa que venceu a licitação.",
    ],
    correta: 0,
    explicacao:
      "Poxa, não foi dessa vez! Mas vou te dar uma dica: existe um site oficial chamado PNCP, onde são divulgadas informações sobre as compras e contratações públicas. Assim, qualquer pessoa pode acompanhar e saber como o dinheiro público está sendo utilizado.",
    mensagemAcerto:
      "Isso mesmo! Muito bem! Quando as compras públicas são divulgadas, todos podem acompanhar e fiscalizar. Transparência é fundamental para garantir que o dinheiro público seja bem utilizado!",
    falaConcluido:
      "Parabéns de novo! Agora você sabe que até as compras da Prefeitura precisam seguir regras e ser transparentes. Continue sua missão: a próxima etapa já está esperando por você!",
  },
  {
    id: "obras",
    nome: "Obras Públicas",
    nomeCurto: "Obras",
    cor: "#F07D1A",
    destaque: "#2B2B2B",
    decoracao: "obras",
    npc: {
      nome: "Eng.ª Paula", modelo: "feminino",
      cargo: "Fiscal de Obras",
      pele: "#B57C55", cabelo: "#3B2314", estiloCabelo: "rabo",
      camisa: "#F07D1A", calca: "#2F4A6B", acessorio: "capacete", altura: 1.68, corpo: 1.0 },
    curiosidade: [
      "Você já passou por uma rua em obras ou viu a construção de uma escola ou de uma quadra esportiva?\n\nPois saiba que toda obra pública precisa ser acompanhada de perto por um profissional responsável por fiscalizar se tudo está sendo feito como foi planejado.\n\nE sabe aquela placa que fica perto da obra? Ela também é importante! Nela, você pode encontrar informações como o que está sendo construído, quanto vai custar, qual é o prazo e quem é a empresa responsável.",
      "Mas atenção: a Prefeitura não pode simplesmente pagar pelo que a empresa diz que fez!\n\nAntes de pagar por cada etapa da obra, é preciso conferir se o serviço foi realmente realizado e se está de acordo com o que foi contratado.\n\nÉ como conferir se todos os materiais comprados para uma atividade da escola foram entregues antes de fazer o pagamento.\n\nResumindo: primeiro confere, depois paga!",
    ],
    baseLegal: "Lei nº 4.320/1964, arts. 62 e 63 · Lei nº 14.133/2021, art. 117.",
    pergunta:
      "Antes de pagar por uma etapa de uma obra pública, o que a Prefeitura precisa fazer?",
    alternativas: [
      "Pagar todo o valor combinado antes mesmo de a obra começar a ser feita.",
      "Esperar a inauguração da obra para só então conferir se ela foi feita.",
      "Pagar o valor que a empresa pedir, sem verificar se o serviço foi feito.",
      "Conferir se o serviço foi realmente realizado antes de fazer o pagamento.",
    ],
    correta: 3,
    explicacao:
      "Não foi dessa vez! Mas vou te explicar: antes de pagar por uma etapa da obra, a Prefeitura precisa conferir se o serviço foi realmente realizado. Assim, evita pagar por algo que não foi feito. Afinal, o dinheiro é de todos e precisa ser bem cuidado!",
    mensagemAcerto:
      "Muito bem! Você acertou! Acompanhar e fiscalizar as obras ajuda a garantir que o dinheiro público seja bem utilizado. Afinal, uma obra bem feita faz diferença na vida de todos!",
    falaConcluido:
      "Parabéns de novo! Agora você sabe que fiscalizar uma obra também é cuidar da cidade. Continue sua missão: a próxima etapa já está esperando por você!",
  },
  {
    id: "dados",
    nome: "Dados Abertos",
    nomeCurto: "Dados Abertos",
    cor: "#14A44D",
    destaque: "#DDF7E6",
    decoracao: "dados",
    npc: {
      nome: "Lucas", modelo: "masculino",
      cargo: "Cientista de Dados",
      pele: "#E0AC86", cabelo: "#C2852F", estiloCabelo: "topete",
      camisa: "#14A44D", calca: "#263238", acessorio: "headset", altura: 1.76, corpo: 0.96 },
    curiosidade: [
      "Dados abertos são dados públicos publicados de um jeito que qualquer pessoa ou sistema consiga ler, cruzar e reutilizar, inclusive para criar aplicativos e pesquisas.",
      "A LAI pede que os portais ofereçam dados em formatos abertos, estruturados e legíveis por máquina. Uma planilha em CSV pode ser processada por computador; um PDF escaneado ou uma foto, não.",
    ],
    baseLegal: "Lei nº 12.527/2011, art. 8º, § 3º · Decreto nº 8.777/2016",
    pergunta:
      "Qual destes formatos é o mais adequado para publicar dados abertos?",
    alternativas: [
      "PDF escaneado de um documento impresso e assinado.",
      "Foto da tela do sistema, tirada pelo celular.",
      "Arquivo CSV, estruturado e legível por máquina.",
      "Imagem JPG de uma tabela, em alta resolução.",
    ],
    correta: 2,
    explicacao:
      "Dados abertos devem estar em formato aberto, estruturado e legível por máquina, como CSV ou JSON. PDFs escaneados e imagens impedem que os dados sejam reutilizados e analisados.",
    mensagemAcerto:
      "Excelente! Dado aberto é dado que gera valor para a sociedade.",
  },
];

/* ---------------------------------------------------------------------
 * CHEFE FINAL (BOSS)
 * ------------------------------------------------------------------- */
CT.BOSS = {
  nome: "Corrupson",
  cargo: "O Monstro da Corrupção",
  predio: "Torre da Transparência",
  // A vida do chefe é igual ao número de perguntas: cada acerto tira 1 ponto
  // de vida. O último acerto o transforma em fumaça.
  falasIniciais: [
    "Ha! Ha! Ha! Então você conseguiu chegar até aqui? Eu sou o Corrupson! E nesta torre quem manda sou eu! Aqui, escondo informações, tranco os segredos e ninguém descobre como o dinheiro da cidade é usado!",
    "Mas parece que você aprendeu algumas coisas pelo caminho... Vamos ver se sabe mesmo tudo sobre transparência!\n\nVou fazer três perguntas. A cada resposta certa, você vai tirar um pouco da minha força e fazer a Torre da Transparência brilhar novamente!\n\nQuero ver se você consegue! Está preparado ou preparada?",
  ],
  // títulos das mensagens de acerto
  tituloGolpe: "Golpe certeiro! Corrupson perdeu força!",
  tituloGolpeFinal: "Golpe final! Corrupson foi derrotado!",
  perguntas: [
    {
      titulo: "A informação é um direito!",
      pergunta:
        "Vamos começar! Eu adoro esconder informações! Mas me diga: segundo a Lei de Acesso à Informação, qual é a regra para as informações públicas?",
      alternativas: [
        "O governo pode esconder todas as informações, se quiser, sem precisar dar nenhuma explicação à população.",
        "As informações devem ser divulgadas para todos. O sigilo só acontece em situações especiais previstas em lei.",
        "Somente os servidores públicos podem conhecer essas informações. O cidadão comum não tem direito de acesso.",
        "Só podemos conhecer as informações quando o prefeito autorizar. Sem a autorização dele, tudo fica em sigilo.",
      ],
      correta: 1,
      explicacoesErro: [
        "Ha! Errou! As informações públicas devem ser divulgadas. Eu adoraria que tudo fosse segredo, mas a lei não deixa!",
        "Que pena! Qualquer pessoa pode ter acesso às informações públicas, não apenas os servidores!",
        "Errou! A transparência é um direito garantido por lei. Não depende da autorização do prefeito!",
      ],
      falaDano: "Aaaaah! Você sabe mesmo! A informação é um direito de todos! Essa luz está incomodando meus olhos!",
    },
    {
      titulo: "O tempo está passando!",
      pergunta:
        "Argh! Vamos ver se você sabe mesmo! Eu adoro esconder informações e deixar as pessoas esperando! Mas, quando alguém pede uma informação ao governo e ela não está disponível, qual é o prazo para receber uma resposta?",
      alternativas: [
        "Até 20 dias, podendo ganhar mais 10 dias se houver uma justificativa.",
        "Até 90 dias, sem precisar explicar a demora para quem fez o pedido.",
        "Não existe prazo. O governo responde quando quiser, sem pressa alguma.",
        "Até 5 dias. Depois disso, o pedido é arquivado e simplesmente desaparece!",
      ],
      correta: 0,
      explicacoesErro: [
        "Ha! Errou! O prazo é de até 20 dias e pode ser prorrogado por mais 10, mas o governo precisa explicar o motivo!",
        "Nada disso! O governo tem prazo para responder. Não pode deixar ninguém esperando para sempre!",
        "Quase! O pedido não desaparece! O prazo é de até 20 dias, podendo ser prorrogado por mais 10, com justificativa!",
      ],
      falaDano: "Nããão! Você sabe até os prazos! Assim fica difícil esconder as informações! Minha força está diminuindo!",
    },
    {
      titulo: "O grande desafio da transparência!",
      pergunta:
        "Grrrr! Você chegou longe, mas ainda não acabou! Imagine que uma criança quer descobrir quanto dinheiro a Prefeitura gastou para reformar uma escola e se a obra foi realizada de verdade. O que ela pode fazer?",
      alternativas: [
        "Desistir, porque ninguém pode saber quanto dinheiro foi gasto na obra. Essas informações ficam guardadas só com a Prefeitura e a empresa contratada.",
        "Esperar até o final do ano para descobrir essas informações. Antes disso, nada é divulgado e não adianta procurar no site nem perguntar na Prefeitura.",
        "Consultar o Portal da Transparência. Se não encontrar tudo, pode pedir a informação pela LAI e, se perceber algo errado, registrar uma manifestação na Ouvidoria.",
        "Pedir a informação somente se tiver autorização do diretor da escola. Sem essa autorização por escrito, a Prefeitura não é obrigada a responder.",
      ],
      correta: 2,
      explicacoesErro: [
        "Ha! Ha! Ha! Não precisa desistir! O Portal da Transparência permite acompanhar como o dinheiro público é utilizado!",
        "Errou! Não precisa esperar o fim do ano! As informações devem ser divulgadas para que todos possam acompanhar!",
        "Nada disso! Qualquer pessoa pode pedir informações públicas, sem precisar de autorização ou explicar o motivo!",
      ],
    },
  ],
  falaDerrota:
    "Nããããão! Você descobriu meus segredos! Portal da Transparência, Lei de Acesso à Informação e Ouvidoria... Quando todos conhecem seus direitos, fica muito mais difícil esconder as coisas!\n\nMinha força está acabando! Estou virando... fumaçaaaa!",
};

/* ---------------------------------------------------------------------
 * MODELOS 3D (arquivos .glb em assets/modelos/originais/)
 * Cada .glb tem uma cópia embutida em assets/modelos/js/<arquivo>.js,
 * para o jogo abrir direto do disco. Para trocar um modelo, veja o
 * LEIA-ME (seção "Trocar modelos 3D").
 * ------------------------------------------------------------------- */
CT.MODELOS = {
  pasta: "assets/modelos/",
  personagens: {
    // Personagem humana do Mixamo (Adobe). Roupas, cabelo e tom de pele são
    // recoloridos por personagem.
    feminino: { arquivo: "michelle.glb", altura: 1.72, recolorir: true, origem: "Mixamo — Michelle",
      cabeca: { abaixoDoTopo: 0.2, frente: 0.1 }, torso: { frente: 0.11, altura: 0.04, costas: 0.15 } },
    // Protagonistas masculinos: avatares Ready Player Me (CC BY-NC 4.0, uso não
    // comercial), mesmo esqueleto do Mixamo. Recebem as animações do X Bot.
    // tingirTexturas: para cada material, regras por faixa de cor (h = matiz
    // 0–360, s = saturação 0–1, v = brilho 0–1). A 1ª regra que casa vale;
    // "cor" é a chave da cor no personagem (pele, cabelo, camisa...). Regra
    // sem "cor" mantém o pixel original (ex.: camisa branca, botões).
    // Personagens feitos a partir de desenhos enviados pela equipe
    // (ferramentas/personagem-desenho/): as cores já vêm prontas na textura.
    // Luana: Michelle (Mixamo) com cabelo comprido novo, sorriso, delineado,
    // jaqueta jeans e blusa amarela.
    mulherJaqueta: { arquivo: "mulher-jaqueta.glb", altura: 1.69, origem: "Mixamo — Michelle, adaptada a partir do desenho",
      cabeca: { abaixoDoTopo: 0.2, frente: 0.1 }, torso: { frente: 0.13, altura: 0.04, costas: 0.17 } },
    // Seu Lima, guarda municipal do pórtico de boas-vindas (feito a partir de uma foto):
    // o mesmo avatar do Caio, com sorriso largo, farda, boné de guarda e coturnos (tudo no arquivo).
    // O Prefeito (desenho da equipe): calvo, óculos de armação fina, camisa social branca.
    prefeito: { arquivo: "prefeito.glb", altura: 1.74, origem: "Ready Player Me (Babylon.js), adaptado a partir do desenho",
      cabeca: { abaixoDoTopo: 0.14, frente: 0.1 }, torso: { frente: 0.13, altura: 0.02, costas: 0.16 } },
    guarda: { arquivo: "guarda-lima.glb", altura: 1.74, origem: "Ready Player Me (Babylon.js), adaptado a partir de uma foto",
      cabeca: { abaixoDoTopo: 0.16, frente: 0.1 }, torso: { frente: 0.13, altura: 0.02, costas: 0.16 } },
    // Pricylla: Michelle (Mixamo) refeita a partir do desenho: cabelo castanho liso e comprido, sem franja,
    // blusa branca de manga bufante e colar de coração.
    // Lorena (ouvidora, prédio 3): Michelle (Mixamo) refeita a partir do desenho: cabelo preto
    // ondulado e comprido, risca no meio e preso atrás das orelhas, brincos de pérolas e blusa
    // listrada de azul-marinho e creme de mangas compridas.
    lorena: { arquivo: "lorena.glb", altura: 1.66, origem: "Mixamo — Michelle, adaptada a partir do desenho",
      cabeca: { abaixoDoTopo: 0.2, frente: 0.1 }, torso: { frente: 0.13, altura: 0.04, costas: 0.17 } },
    helenaCabelo: { arquivo: "helena.glb", altura: 1.68, origem: "Mixamo — Michelle, adaptada a partir do desenho",
      cabeca: { abaixoDoTopo: 0.2, frente: 0.1 }, torso: { frente: 0.13, altura: 0.04, costas: 0.17 } },
    // Paulo: avatar Ready Player Me de terno refeito a partir do desenho: terno azul, camisa branca,
    // gravata vinho, cabelo preto curto e sorriso.
    pauloTerno: { arquivo: "paulo.glb", altura: 1.79, origem: "Ready Player Me (Three.js), adaptado a partir do desenho",
      cabeca: { abaixoDoTopo: 0.14, frente: 0.1 }, torso: { frente: 0.13, altura: 0.02, costas: 0.16 } },
    // Ana: Michelle (Mixamo) refeita a partir do desenho: tranças nagô com rabo de tranças em
    // degradê, argolas, camisa social listrada com decote em V, relógio e calça marrom com correntes.
    anaTrancas: { arquivo: "ana.glb", altura: 1.68, origem: "Mixamo — Michelle, adaptada a partir do desenho",
      cabeca: { abaixoDoTopo: 0.2, frente: 0.1 }, torso: { frente: 0.13, altura: 0.04, costas: 0.17 } },
    // Caio: avatar Ready Player Me refeito a partir do desenho: barba cheia, cabelo com degradê,
    // sorriso com aparelho, camiseta vermelha de manga curta e corrente com crucifixo.
    caioBarba: { arquivo: "caio.glb", altura: 1.78, origem: "Ready Player Me (Babylon.js), adaptado a partir do desenho",
      cabeca: { abaixoDoTopo: 0.14, frente: 0.1 }, torso: { frente: 0.13, altura: 0.02, costas: 0.16 } },
    // Seu Antônio: o avatar do Caio com sorriso leve, cabelo grisalho, rugas,
    // camisa social azul-marinho e relógio.
    senhorCamisa: { arquivo: "senhor-camisa.glb", altura: 1.76, origem: "Ready Player Me (Babylon.js), adaptado a partir do desenho",
      cabeca: { abaixoDoTopo: 0.13, frente: 0.1 }, torso: { frente: 0.13, altura: 0.02, costas: 0.16 } },
    // Homem low-poly do "Ultimate Animated Character Pack" (Quaternius, CC0).
    // Cada material (pele, cabelo, camisa, calça) recebe a cor do personagem.
    masculino: { arquivo: "worker.glb", altura: 1.78, origem: "Quaternius — Worker (CC0)",
      tingirMateriais: { Shirt: "camisa", Pants: "calca", Skin: "pele", Hair: "cabelo", Socks: "sapato" },
      cabeca: { abaixoDoTopo: 0.13, frente: 0.105 }, torso: { frente: 0.13, altura: 0.02, costas: 0.15 },
      animacoes: { parado: "HumanArmature|Man_Idle", andar: "HumanArmature|Man_Walk", correr: "HumanArmature|Man_Run", comemorar: "HumanArmature|Man_Clapping" } },
    // Aventureiro (Quaternius, CC0): usado entre os pedestres.
    aventureiro: { arquivo: "adventurer.glb", altura: 1.76, origem: "Quaternius — Adventurer (CC0)",
      animacoes: { parado: "CharacterArmature|Idle", andar: "CharacterArmature|Walk", correr: "CharacterArmature|Run", acenar: "CharacterArmature|Wave" } },
    // Chefe final: RobotExpressive (domínio público, CC0) com animações próprias.
    // Corrupson, o chefe final: monstro peludo feito a partir de um desenho da equipe, com malha
    // nova sobre o esqueleto do RobotExpressive (as animações vêm dele).
    corrupson: {
      arquivo: "corrupson.glb", altura: 5.0, origem: "Desenho da equipe, sobre o esqueleto do RobotExpressive (CC0)",
      animacoes: { parado: "Idle", andar: "Walking", correr: "Running", provocar: "Dance", derrota: "Death", acenar: "Wave", falar: "Idle", comemorar: "Jump", negar: "No", pular: "Jump" },
      gestosChefe: true, // raiva (pula e sacode os braços), comemoração e reação ao golpe
    },
  },
  // Animações do rig Mixamo usadas por todos os personagens humanos
  animacoes: {
    parado: { arquivo: "xbot.glb", clipe: "idle" },
    andar: { arquivo: "xbot.glb", clipe: "walk" },
    correr: { arquivo: "xbot.glb", clipe: "run" },
    concordar: { arquivo: "xbot.glb", clipe: "agree" },
    negar: { arquivo: "xbot.glb", clipe: "headShake" },
    comemorar: { arquivo: "michelle.glb", clipe: "SambaDance" },
  },
  // Objetos urbanos KayKit City Builder Bits (Kay Lousberg, CC0)
  objetos: {
    carros: ["car_sedan.glb", "car_taxi.glb", "car_hatchback.glb", "car_stationwagon.glb", "car_police.glb"],
    poste: "streetlight.glb",
    semaforo: "trafficlight_A.glb",
    banco: "bench.glb",
    hidrante: "firehydrant.glb",
    lixeira: "trash_A.glb",
    cacamba: "dumpster.glb",
    arbusto: "bush.glb",
    lojas: ["building_A.glb", "building_B.glb", "building_E.glb", "building_F.glb"],
  },
};

/* Protagonista */
/* ---------------------------------------------------------------------
 * PERSONAGENS JOGÁVEIS (tela "Escolha sua personagem")
 * genero: "f" ou "m" (ajusta textos como "Bem-vinda"/"Bem-vindo").
 * Cores e acessórios seguem as mesmas chaves dos NPCs; os modelos estão em
 * CT.MODELOS.personagens. A 1ª da lista é a escolhida por padrão.
 * ------------------------------------------------------------------- */
CT.PERSONAGENS = [
  { id: "ana", nome: "Ana", genero: "f", papel: "Estudante de jornalismo",
    descricao: "Tranças nagô, argolas douradas e camisa listrada. Quer descobrir para onde vai cada centavo do dinheiro público.",
    modelo: "anaTrancas" },
  { id: "helena", nome: "Pricylla", genero: "f", papel: "Professora de história",
    descricao: "Cabelo comprido, sorriso fácil e colar de coração. Apaixonada por arquivos e documentos antigos: acredita que memória e transparência andam juntas.",
    modelo: "helenaCabelo" },
  { id: "caio", nome: "Caio", genero: "m", papel: "Músico e líder comunitário",
    descricao: "Barba cheia, sorriso de aparelho e corrente no peito. Organiza o bairro, acompanha cada obra da prefeitura e não desiste da resposta.",
    modelo: "caioBarba" },
  { id: "paulo", nome: "Paulo", genero: "m", papel: "Jornalista investigativo",
    descricao: "Terno azul, gravata vinho e sorriso confiante. Conhece cada licitação da cidade de cor e salteado.",
    modelo: "pauloTerno" },
  { id: "luana", nome: "Luana", genero: "f", papel: "Comunicadora digital",
    descricao: "Sorriso aberto e a inseparável jaqueta jeans. Explica nas redes, em linguagem simples, tudo o que descobre nos portais de transparência.",
    modelo: "mulherJaqueta" },
  { id: "antonio", nome: "Seu Antônio", genero: "m", papel: "Contador aposentado",
    descricao: "Cabelo grisalho, camisa social e relógio no pulso. Confere as contas públicas linha por linha, com calma e bom humor.",
    modelo: "senhorCamisa" },
];
// compatibilidade: protagonista padrão
CT.PROTAGONISTA = CT.PERSONAGENS[0];

/* ---------------------------------------------------------------------
 * TEMPO, ESTAÇÕES E CLIMA DA JORNADA
 * Um estado para cada quantidade de prédios concluídos (0 a 8), mais o
 * estado da vitória. A mudança acontece de forma gradual quando o
 * jogador sai de um prédio concluído.
 *   hora:    0 a 24 (fictícia; 8.5 = 8h30)
 *   estacao: "primavera" | "verao" | "outono" | "inverno"
 *   clima:   "sol" | "parcial" | "nublado" | "chuva-fraca" | "chuva-forte"
 * ------------------------------------------------------------------- */
CT.TEMPO = [
  { hora: 8.0, estacao: "primavera", clima: "sol" },         // início: manhã de primavera
  { hora: 9.5, estacao: "primavera", clima: "parcial" },
  { hora: 11.0, estacao: "verao", clima: "sol" },            // final da manhã, verão
  { hora: 12.5, estacao: "verao", clima: "nublado" },        // o céu fecha
  { hora: 14.0, estacao: "verao", clima: "chuva-forte" },    // pancada de chuva de verão
  { hora: 15.25, estacao: "outono", clima: "chuva-fraca" },  // a chuva perde força
  { hora: 16.25, estacao: "outono", clima: "parcial" },      // tempo abre, folhas caindo
  { hora: 17.75, estacao: "outono", clima: "sol" },          // pôr do sol
  { hora: 19.5, estacao: "inverno", clima: "chuva-fraca" },  // desafio final: noite fria de inverno
];
CT.TEMPO_VITORIA = { hora: 20.25, estacao: "inverno", clima: "sol" }; // céu limpo e estrelado

/* Presets de clima (nuvens e chuva de 0 a 1) */
CT.CLIMAS = {
  "sol":         { nuvens: 0.08, chuva: 0,    rotulo: "Ensolarado" },
  "parcial":     { nuvens: 0.42, chuva: 0,    rotulo: "Parcialmente nublado" },
  "nublado":     { nuvens: 0.85, chuva: 0,    rotulo: "Nublado" },
  "chuva-fraca": { nuvens: 0.9,  chuva: 0.35, rotulo: "Chuva fraca" },
  "chuva-forte": { nuvens: 1,    chuva: 1,    rotulo: "Chuva forte" },
};
CT.CONFIG.duracaoTransicaoTempo = 9; // segundos de cada transição

/* ---------------------------------------------------------------------
 * SEU LIMA — guarda municipal junto ao pórtico de boas-vindas
 * Acena para quem chega; com ESPAÇO perto dele, recebe o jogador e conta
 * a história do jogo (uma fala por página).
 * ------------------------------------------------------------------- */


CT.SEU_LIMA = {
  nome: "Seu Lima",
  cargo: "Guarda Municipal",
  modelo: "guarda",
  falas: [
    "Bom dia, {meu comandante|minha comandante}! Seja muito {bem-vindo|bem-vinda}. Eu sou o Seu Lima, guarda municipal desta cidade.\n\nQue alegria ver você chegando para a Jornada da Transparência!\n\nEstamos precisando de um herói ou de uma heroína para uma missão muito especial. Será que posso contar com você?",
    "Vou contar um segredo... Um monstrinho chamado Corrupson apareceu por aqui e está aprontando a maior confusão! Ele está escondendo informações, colocando placas de CONFIDENCIAL em tudo e não quer que ninguém descubra como o dinheiro da cidade é utilizado. Se ele continuar assim, ninguém vai conseguir acompanhar o que acontece na nossa cidade!",
    "Mas calma! Nem tudo está perdido! Você pode nos ajudar a derrotar o Corrupson!\n\nA cidade tem 8 Estações da Transparência. Em cada uma delas, você vai encontrar um servidor que conhece um segredo importante para ajudar a cidade: Portal da Transparência, Acesso à Informação, Ouvidoria, Controle Social, Proteção de Dados, Licitações e outros temas importantes.",
    "Sua missão é visitar cada estação, descobrir coisas interessantes e responder aos desafios.\n\nAcertou? Muito bem!\n\nO caminho para a próxima fase será liberado e você ganhará pontos!\n\nFique de olho na seta no chão: ela vai mostrar o caminho da sua aventura.\n\nE lembre-se: quanto mais rápido e corretamente você responder, mais pontos poderá conquistar!",
    "E sabe onde essa aventura vai terminar? Na Torre da Transparência!\n\nÉ lá que o Corrupson estará esperando por você com três desafios finais.\n\nSe conseguir acertar todos, a torre voltará a brilhar e nossa cidade ficará muito mais transparente!\n\nE aí? Preparado ou preparada para essa missão?\n\nEntão, vamos nessa! Eu fico aqui de olho em tudo.\n\nBoa sorte, meu pequeno guardião da transparência!",
  ],
};

/* ---------------------------------------------------------------------
 * OUTDOORS NO ALTO DOS PRÉDIOS
 * Cada outdoor mostra um logo de CT.CONFIG.logosApoio (pelo id) ou "todos"
 * (os quatro lado a lado), sobre fundo branco. Eles se repetem em
 * sequência pelos prédios da cidade e acendem à noite.
 * ------------------------------------------------------------------- */
CT.OUTDOORS = {
  quantidade: 14,
  pecas: [
    { logo: "todos" },
    { logo: "prefeitura-jaboatao" },
    { logo: "cgm" },
    { logo: "cri" },
    { logo: "ctrl-lab" },
  ],
};

/* ---------------------------------------------------------------------
 * CRÉDITOS (tela inicial → Créditos)
 * ------------------------------------------------------------------- */
// Aviso de licenças, em destaque no topo da tela de Créditos
CT.CREDITOS_AVISO = "Todos os recursos de terceiros usados neste jogo (músicas, modelos 3D, fontes e bibliotecas) são gratuitos e de uso livre: estão em domínio público (CC0) ou sob licenças abertas e gratuitas que permitem o uso institucional sem custo. Prédios, interiores, céu, clima e efeitos sonoros foram criados no próprio código do jogo.";

// Cada linha: [título, texto] ou [título, [item, item, ...]]
CT.CREDITOS = [
  ["Realização", "Controladoria Geral do Município (CGM) e CRI – Comitê de Relações Institucionais · Dia da Transparência, 18 de novembro"],
  ["Músicas", [
    "Menu principal: “16-bit Relationship”, de Yoshiyuki Tatsuya · Pixabay (Licença de Conteúdo Pixabay: uso gratuito, sem custo)",
    "Cidade e prédios: “City Sunshine”, de Kevin MacLeod · FreePD (domínio público, CC0)",
    "Batalha final: “Kings Trailer”, de Rafael Krux · FreePD (domínio público, CC0)",
  ]],
  ["Personagens", [
    "Animações e personagens de apoio: Michelle e X Bot · Mixamo/Adobe (uso gratuito, inclusive em projetos institucionais e comerciais)",
    "Pricylla: criada a partir de um desenho enviado pela equipe, sobre a Michelle do Mixamo (cabelo, rosto, blusa e colar refeitos para o jogo)",
    "Lorena, a ouvidora: criada a partir de um desenho enviado pela equipe, sobre a Michelle do Mixamo (cabelo ondulado, rosto, blusa listrada e brincos de pérolas refeitos para o jogo)",
    "Ana: criada a partir de um desenho enviado pela equipe, sobre a Michelle do Mixamo (tranças, rosto, camisa, acessórios e roupas refeitos para o jogo)",
    "Caio: criado a partir de um desenho enviado pela equipe, sobre um avatar Ready Player Me (barba, cabelo, aparelho, camiseta e corrente refeitos para o jogo)",
    "Prefeito: criado a partir de um desenho enviado pela equipe, sobre um avatar Ready Player Me (licença Creative Commons 4.0 para uso não comercial; rosto, cabelo, óculos e camisa refeitos para o jogo)",
    "Paulo: criado a partir de um desenho enviado pela equipe, sobre um avatar Ready Player Me (licença Creative Commons 4.0 para uso não comercial; rosto, cabelo, terno e gravata refeitos para o jogo)",
    "Luana: criada a partir de um desenho enviado pela equipe, sobre a Michelle do Mixamo (cabelo, rosto, jaqueta e roupas refeitos para o jogo)",
    "Corrupson: criado a partir de um desenho enviado pela equipe; malha nova sobre o esqueleto e as animações do RobotExpressive, de Tomás Laulhé (domínio público, CC0)",
    "Seu Lima (guarda municipal): criado a partir de uma foto enviada pela equipe, sobre um avatar Ready Player Me (rosto, sorriso, farda e boné refeitos para o jogo)",
    "Seu Antônio: criado a partir de um desenho enviado pela equipe, sobre um avatar Ready Player Me (rosto, cabelo, camisa e relógio refeitos para o jogo)",
    "Servidores e moradores: Worker e Adventurer, de Quaternius (domínio público, CC0)",
  ]],
  ["Cidade", "Carros, postes, semáforos, bancos e lojas: KayKit City Builder Bits, de Kay Lousberg (domínio público, CC0)"],
  ["Tecnologia", "Three.js r147 (licença MIT, livre) · fontes Bricolage Grotesque e Figtree (SIL Open Font License, livre)"],
  ["Sons", [
    "Abertura: “Intro”, de DarioCoiro · Pixabay (Licença de Conteúdo Pixabay: uso gratuito, sem custo)",
    "Efeitos, passos, chuva e trovões sintetizados no próprio navegador",
  ]],
];

/* ---------------------------------------------------------------------
 * TELA FINAL
 * ------------------------------------------------------------------- */
// partida encerrada pelo menu (ESC → SAIR DO JOGO)
CT.ENCERRADA = {
  titulo: "Até a próxima!",
  mensagem: "Partida encerrada. Registre seu nome para guardar a pontuação feita até aqui.",
};

CT.FINAL = {
  // faixa mostrada quando a torre volta a brilhar
  faixa: "A TORRE DA TRANSPARÊNCIA VOLTA A BRILHAR!",
  titulo: "MISSÃO CUMPRIDA!",
  mensagem:
    "Parabéns, pequeno guardião da transparência!\n\nVocê venceu o Corrupson e ajudou a devolver o brilho à Torre da Transparência!\n\nAgora você já sabe: todos têm direito de conhecer as informações públicas, fazer perguntas e ajudar a cuidar da cidade.\n\nLembre-se: uma cidade melhor começa quando as pessoas conhecem seus direitos e participam!\n\nVocê também pode ajudar a cuidar da cidade!",
};
