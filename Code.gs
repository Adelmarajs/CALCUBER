/**
 * Corrida Fácil — Web App (Google Apps Script)
 * Calcula corridas de transporte particular usando Google Maps e Sheets.
 *
 * URL implantada:
 *   https://script.google.com/macros/s/AKfycbwPZYTYXyietuECQjOEkj2CPlDZFbL3VH6pJnj5gZSBvfe8K_zvW4aTWpGLN-TAezKQ/exec
 */

// ============================================================
// CONFIGURAÇÕES
// ============================================================

var NOME_PLANILHA = 'CorridasTransporte';
var ABA_USUARIOS  = 'Usuarios';
var ABA_LOGS      = 'LogsCorridas';

// ============================================================
// doGet
// ============================================================

function doGet(e) {
  try {
    const acao = e.parameter.acao || 'calcular';

    if (acao === 'login') {
      return handleLogin(e);
    }

    const origem = e.parameter.origem;
    const destino = e.parameter.destino;
    const taxaFixa = parseFloat(e.parameter.taxaFixa) || 0;
    const precoKm = parseFloat(e.parameter.precoKm) || 0;
    const emailMotorista = e.parameter.emailMotorista || '';

    if (!origem || !destino) {
      return responderJson(false, 'Origem e destino são obrigatórios.');
    }

    const directions = Maps.newDirectionFinder()
      .setOrigin(origem)
      .setDestination(destino)
      .setMode(Maps.DirectionFinder.Mode.DRIVING)
      .getDirections();

    const rota = directions.routes[0].legs[0];
    const distanciaKm = Math.round((rota.distance.value / 1000) * 100) / 100;
    const tempoMin = Math.round(rota.duration.value / 60);

    const precoFinal = Math.round(((distanciaKm * precoKm) + taxaFixa) * 100) / 100;

    inserirLog(emailMotorista, origem, destino, distanciaKm, tempoMin, taxaFixa, precoKm, precoFinal);

    return responderJson(true, 'Corrida calculada com sucesso.', {
      origem: origem,
      destino: destino,
      distanciaKm: distanciaKm,
      tempoMinutos: tempoMin,
      taxaFixa: taxaFixa,
      precoKm: precoKm,
      precoFinal: precoFinal
    });

  } catch (error) {
    return responderJson(false, error.toString());
  }
}

// ============================================================
// doPost
// ============================================================

function doPost(e) {
  try {
    var dados;

    if (e.postData && e.postData.contents) {
      try {
        dados = JSON.parse(e.postData.contents);
      } catch (ignorar) {
        dados = e.parameter;
      }
    } else {
      dados = e.parameter;
    }

    const acao = (dados.acao || 'calcular').toLowerCase();

    if (acao === 'login') {
      return handleLogin({ parameter: { email: dados.email, senha: dados.senha } });
    }

    if (acao === 'registrar') {
      return handleRegister({ parameter: { nome: dados.nome, email: dados.email, senha: dados.senha } });
    }

    if (acao === 'calcular') {
      return doGet({ parameter: dados });
    }

    return responderJson(false, 'Ação inválida. Use: login, registrar ou calcular.');

  } catch (erro) {
    return responderJson(false, 'Erro no servidor: ' + erro.message);
  }
}

// ============================================================
// handleLogin
// ============================================================

function handleLogin(e) {
  try {
    const email = (e.parameter.email || '').trim().toLowerCase();
    const senha = (e.parameter.senha || '').trim();

    if (!email || !senha) {
      return responderJson(false, 'Email e senha são obrigatórios.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName(ABA_USUARIOS);

    if (!aba) {
      return responderJson(false, 'Nenhum usuário cadastrado.');
    }

    const dados = aba.getDataRange().getValues();
    const senhaHash = gerarHash(senha);

    for (let i = 1; i < dados.length; i++) {
      const emailPlanilha = (dados[i][0] || '').toString().trim().toLowerCase();
      const senhaPlanilha = (dados[i][1] || '').toString().trim();

      if (emailPlanilha === email && senhaPlanilha === senhaHash) {
        return responderJson(true, 'Login realizado.', {
          token: 'token_' + Date.now(),
          nome: dados[i][2] || 'Motorista'
        });
      }
    }

    return responderJson(false, 'Email ou senha incorretos.');

  } catch (error) {
    return responderJson(false, 'Erro interno: ' + error.toString());
  }
}

// ============================================================
// handleRegister
// ============================================================

function handleRegister(e) {
  try {
    const nome  = (e.parameter.nome || '').trim();
    const email = (e.parameter.email || '').trim().toLowerCase();
    const senha = (e.parameter.senha || '').trim();

    if (!nome || !email || !senha) {
      return responderJson(false, 'Nome, email e senha são obrigatórios.');
    }

    if (senha.length < 4) {
      return responderJson(false, 'A senha deve ter ao menos 4 caracteres.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName(ABA_USUARIOS);

    // Cria a aba com cabeçalho se não existir
    if (!aba) {
      aba = ss.insertSheet(ABA_USUARIOS);
      aba.appendRow(['email', 'senhaHash', 'nome', 'ativo', 'dataCriacao']);
    }

    const dados = aba.getDataRange().getValues();

    // Verifica se email já existe
    for (let i = 1; i < dados.length; i++) {
      const existente = (dados[i][0] || '').toString().trim().toLowerCase();
      if (existente === email) {
        return responderJson(false, 'Este email já está cadastrado.');
      }
    }

    // Insere novo usuário (senha com hash SHA-256)
    aba.appendRow([email, gerarHash(senha), nome, 'SIM', new Date()]);

    return responderJson(true, 'Conta criada com sucesso! Faça login.', {
      email: email,
      nome: nome
    });

  } catch (error) {
    return responderJson(false, 'Erro ao criar conta: ' + error.toString());
  }
}

// ============================================================
// LOG
// ============================================================

function inserirLog(email, origem, destino, dist, tempo, taxa, precoKm, total) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName(ABA_LOGS);

    if (!aba) {
      aba = ss.insertSheet(ABA_LOGS);
      aba.appendRow(['timestamp', 'emailMotorista', 'origem', 'destino', 'distanciaKm', 'tempoMinutos', 'taxaFixa', 'precoKm', 'precoFinal']);
    }

    aba.appendRow([new Date(), email, origem, destino, dist, tempo, taxa, precoKm, total]);

  } catch (ignorar) {}
}

// ============================================================
// PLANILHA
// ============================================================

function getPlanilha() {
  var arquivos = SpreadsheetApp.getFilesByName(NOME_PLANILHA);
  var planilha;

  if (arquivos.hasNext()) {
    planilha = arquivos.next();
  } else {
    planilha = SpreadsheetApp.create(NOME_PLANILHA);
  }

  return SpreadsheetApp.openById(planilha.getId());
}

function getAba(nomeAba) {
  var planilha = getPlanilha();
  var aba = planilha.getSheetByName(nomeAba);

  if (aba) return aba;

  aba = planilha.insertSheet(nomeAba);

  if (nomeAba === ABA_USUARIOS) {
    aba.appendRow(['email', 'senhaHash', 'nome', 'ativo', 'dataCriacao']);
  } else if (nomeAba === ABA_LOGS) {
    aba.appendRow(['timestamp', 'emailMotorista', 'origem', 'destino', 'distanciaKm', 'tempoMinutos', 'taxaFixa', 'precoKm', 'precoFinal']);
  }

  return aba;
}

// ============================================================
// UTILITÁRIOS
// ============================================================

// ============================================================
// HASH SHA-256
// ============================================================

function gerarHash(texto) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    texto,
    Utilities.Charset.UTF_8
  );
  return digest.map(function (b) {
    return ('0' + ((b + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function responderJson(sucesso, mensagem, dados) {
  var resposta = {
    sucesso: sucesso,
    mensagem: mensagem || '',
    dados: dados || null
  };

  return ContentService
    .createTextOutput(JSON.stringify(resposta, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// SETUP
// ============================================================

function setupInicial() {
  getAba(ABA_USUARIOS);
  getAba(ABA_LOGS);
  Logger.log('Estrutura criada.');
}

function popularDadosExemplo() {
  var su = getAba(ABA_USUARIOS);
  var sl = getAba(ABA_LOGS);

  var usuarios = [
    ['admin@exemplo.com', gerarHash('123456'), 'Administrador', 'SIM', new Date()],
    ['joao@exemplo.com',  gerarHash('654321'), 'João Silva',   'SIM', new Date()],
    ['maria@exemplo.com', gerarHash('abcdef'), 'Maria Souza',  'NAO', new Date()]
  ];

  if (su.getLastRow() <= 1) {
    for (var i = 0; i < usuarios.length; i++) su.appendRow(usuarios[i]);
  }

  var logs = [
    [new Date(), 'joao@exemplo.com',  'Av. Paulista, 1000', 'Congonhas',       12.5, 30, 5.00, 2.50, 36.25],
    [new Date(), 'maria@exemplo.com', 'Centro',             'Barra da Tijuca', 35.0, 55, 7.00, 3.00, 112.00],
    [new Date(), 'admin@exemplo.com', 'Zona Sul',           'Aeroporto',       20.0, 40, 5.00, 2.80, 61.00]
  ];

  if (sl.getLastRow() <= 1) {
    for (var j = 0; j < logs.length; j++) sl.appendRow(logs[j]);
  }

  Logger.log('Dados de exemplo inseridos.');
}
