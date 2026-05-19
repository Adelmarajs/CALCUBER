/**
 * CalcUber — app.js
 * Motor central: autenticação, API (GAS), formatação, mapas, som e UI.
 *
 * URL do Web App Google Apps Script:
 *   https://script.google.com/macros/s/AKfycbwPZYTYXyietuECQjOEkj2CPlDZFbL3VH6pJnj5gZSBvfe8K_zvW4aTWpGLN-TAezKQ/exec
 */

var CalcUberApp = (function () {
  'use strict';

  // ==============================================================
  // CONFIGURAÇÕES
  // ==============================================================

  var CONFIG = {
    WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbwPZYTYXyietuECQjOEkj2CPlDZFbL3VH6pJnj5gZSBvfe8K_zvW4aTWpGLN-TAezKQ/exec',

    STORAGE_EMAIL:  'calcUber_email',
    STORAGE_TOKEN:  'calcUber_token',
    STORAGE_NOME:   'calcUber_nome',
    STORAGE_LEMBRAR: 'calcUber_lembrar',

    LOGIN_URL:      'index.html',
    DASHBOARD_URL:  'dashboard.html',

    SIMULAR_CALCULO: true,
    SOM_DURACAO_MS: 400
  };

  // ==============================================================
  // API — CHAMADAS AO GOOGLE APPS SCRIPT
  // ==============================================================

  var Api = {
    /**
     * Calcula corrida via doGet do Web App (GET com query params).
     * Retorna JSON diretamente — sem problemas de CORS.
     *
     * @param {string}   origem
     * @param {string}   destino
     * @param {number}   taxaFixa
     * @param {number}   precoKm
     * @param {Function} callback — function(erro, dados)
     */
    calcular: function (origem, destino, taxaFixa, precoKm, callback) {
      var params = new URLSearchParams();
      params.set('origem', origem);
      params.set('destino', destino);
      params.set('taxaFixa', String(taxaFixa));
      params.set('precoKm', String(precoKm));

      var email = Auth.getEmail();
      if (email) params.set('emailMotorista', email);

      var url = CONFIG.WEBAPP_URL + '?' + params.toString();

      fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (json) {
          if (json && json.sucesso && json.dados) {
            callback(null, json.dados);
          } else {
            callback(new Error(json && json.mensagem ? json.mensagem : 'Resposta inválida do servidor.'));
          }
        })
        .catch(function (erro) {
          if (CONFIG.SIMULAR_CALCULO) {
            var sim = Api._simular(origem, destino, taxaFixa, precoKm);
            callback(null, sim);
          } else {
            callback(erro);
          }
        });
    },

    /**
     * Envia login para o Web App via POST.
     * Lê a resposta JSON retornada pelo servidor.
     *
     * @param {string}   email
     * @param {string}   senha
     * @param {Function} callback — function(erro, dados)
     */
    login: function (email, senha, callback) {
      var body = new URLSearchParams();
      body.set('acao', 'login');
      body.set('email', email);
      body.set('senha', senha);

      fetch(CONFIG.WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Erro no servidor');
          return res.json();
        })
        .then(function (json) {
          if (json && json.sucesso) {
            Auth._salvarSessao(email, json.token || 'token_' + Date.now(), json.nome || email.split('@')[0]);
            callback(null, json);
          } else {
            callback(new Error(json && json.mensagem ? json.mensagem : 'Email ou senha incorretos'));
          }
        })
        .catch(function (erro) {
          console.error(erro);
          callback(new Error('Falha ao conectar com o servidor. Verifique sua internet.'));
        });
    },

    /**
     * Envia cadastro para o Web App via POST.
     *
     * @param {string}   nome
     * @param {string}   email
     * @param {string}   senha
     * @param {Function} callback — function(erro, dados)
     */
    registrar: function (nome, email, senha, callback) {
      var body = new URLSearchParams();
      body.set('acao', 'registrar');
      body.set('nome', nome);
      body.set('email', email);
      body.set('senha', senha);

      fetch(CONFIG.WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Erro no servidor');
          return res.json();
        })
        .then(function (json) {
          if (json && json.sucesso) {
            callback(null, json);
          } else {
            callback(new Error(json && json.mensagem ? json.mensagem : 'Erro ao criar conta.'));
          }
        })
        .catch(function (erro) {
          console.error(erro);
          callback(new Error('Falha ao conectar com o servidor. Verifique sua internet.'));
        });
    },

    _simular: function (origem, destino, taxaFixa, precoKm) {
      var dist = parseFloat((Math.random() * 25 + 3).toFixed(2));
      var tempo = Math.ceil(Math.random() * 40 + 10);
      return {
        origem:       origem,
        destino:      destino,
        distanciaKm:  dist,
        tempoMinutos: tempo,
        taxaFixa:     taxaFixa,
        precoKm:      precoKm,
        precoFinal:   parseFloat((dist * precoKm + taxaFixa).toFixed(2))
      };
    }
  };

  // ==============================================================
  // AUTENTICAÇÃO
  // ==============================================================

  var Auth = {
    login: function (email, senha, callback) {
      Api.login(email, senha, callback);
    },

    logout: function () {
      Auth._limparSessao();
      window.location.href = CONFIG.LOGIN_URL;
    },

    isAuthenticated: function () {
      return !!localStorage.getItem(CONFIG.STORAGE_TOKEN);
    },

    getToken: function () {
      return localStorage.getItem(CONFIG.STORAGE_TOKEN);
    },

    getNome: function () {
      return localStorage.getItem(CONFIG.STORAGE_NOME) || 'Usuário';
    },

    getEmail: function () {
      return localStorage.getItem(CONFIG.STORAGE_EMAIL);
    },

    protecaoRota: function () {
      if (!Auth.isAuthenticated()) {
        window.location.href = CONFIG.LOGIN_URL;
      }
    },

    _salvarSessao: function (email, token, nome) {
      localStorage.setItem(CONFIG.STORAGE_EMAIL, email);
      localStorage.setItem(CONFIG.STORAGE_TOKEN, token);
      localStorage.setItem(CONFIG.STORAGE_NOME, nome || 'Usuário');
    },

    _limparSessao: function () {
      localStorage.removeItem(CONFIG.STORAGE_EMAIL);
      localStorage.removeItem(CONFIG.STORAGE_TOKEN);
      localStorage.removeItem(CONFIG.STORAGE_NOME);
      localStorage.removeItem(CONFIG.STORAGE_LEMBRAR);
    }
  };

  // ==============================================================
  // FORMATAÇÃO
  // ==============================================================

  var Format = {
    moeda: function (v) {
      return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    distancia: function (km) {
      return Number(km).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
    },
    tempo: function (min) {
      if (min < 60) return min + ' min';
      var h = Math.floor(min / 60);
      var m = min % 60;
      return h + 'h' + (m > 0 ? ' ' + m + 'min' : '');
    }
  };

  // ==============================================================
  // MAPAS — DEEP LINKS
  // ==============================================================

  var Mapas = {
    abrirGoogleMaps: function (origem, destino) {
      var p = new URLSearchParams();
      p.set('api', '1'); p.set('origin', origem);
      p.set('destination', destino); p.set('travelmode', 'driving');
      window.open('https://www.google.com/maps/dir/?' + p.toString(), '_blank');
    },
    abrirWaze: function (origem, destino) {
      var p = new URLSearchParams();
      p.set('q', destino); p.set('navigate', 'yes');
      window.open('https://waze.com/ul?' + p.toString(), '_blank');
    },
    montarEmbedUrl: function (origem, destino) {
      return 'https://maps.google.com/maps?q=' + encodeURIComponent(origem + ' to ' + destino) + '&t=m&z=13&output=embed';
    }
  };

  // ==============================================================
  // SOM — WEB AUDIO API
  // ==============================================================

  var Som = {
    tocarSucesso: function () {
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        var ctx = new Ctx();
        var dur = CONFIG.SOM_DURACAO_MS / 1000;
        var osc1 = ctx.createOscillator();
        var osc2 = ctx.createOscillator();
        var gain = ctx.createGain();
        osc1.type = 'sine'; osc1.frequency.setValueAtTime(523, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + dur);
        osc2.type = 'sine'; osc2.frequency.setValueAtTime(784, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1047, ctx.currentTime + dur);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
        osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
        osc1.start(); osc2.start();
        osc1.stop(ctx.currentTime + dur + 0.05);
        osc2.stop(ctx.currentTime + dur + 0.05);
        osc1.onended = function () { ctx.close(); };
      } catch (_) {}
    }
  };

  // ==============================================================
  // UI
  // ==============================================================

  var Ui = {
    exibirErro: function (el, msg) {
      if (!el) return;
      el.textContent = msg;
      el.style.display = 'block';
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    limparErro: function (el) {
      if (!el) return;
      el.textContent = '';
      el.style.display = 'none';
    },
    setLoading: function (btn, loading, opts) {
      opts = opts || {};
      if (loading) {
        btn.disabled = true; btn.classList.add('loading');
        if (opts.textEl) opts.textEl.style.display = 'none';
        if (opts.spinnerEl) opts.spinnerEl.style.display = 'inline';
      } else {
        btn.disabled = false; btn.classList.remove('loading');
        if (opts.textEl) opts.textEl.style.display = 'inline';
        if (opts.spinnerEl) opts.spinnerEl.style.display = 'none';
      }
    },
    exibirResultado: function (dados, el) {
      if (!dados || !el) return;

      if (el.resOrigem) el.resOrigem.textContent = dados.origem;
      if (el.resDestino) el.resDestino.textContent = dados.destino;
      if (el.resDistancia) el.resDistancia.textContent = Format.distancia(dados.distanciaKm);
      if (el.resTempo) el.resTempo.textContent = Format.tempo(dados.tempoMinutos);
      if (el.resTaxa) el.resTaxa.textContent = Format.moeda(dados.taxaFixa);
      if (el.resPrecoKm) el.resPrecoKm.textContent = Format.moeda(dados.precoKm);
      if (el.resSubtotal) el.resSubtotal.textContent = Format.moeda(dados.distanciaKm * dados.precoKm);
      if (el.resTotal) el.resTotal.textContent = Format.moeda(dados.precoFinal);

      if (el.mapaIframe) el.mapaIframe.src = Mapas.montarEmbedUrl(dados.origem, dados.destino);

      if (el.linkGmaps) {
        el.linkGmaps.href = 'javascript:void(0)';
        el.linkGmaps.onclick = function (e) { e.preventDefault(); Mapas.abrirGoogleMaps(dados.origem, dados.destino); };
      }
      if (el.linkWaze) {
        el.linkWaze.href = 'javascript:void(0)';
        el.linkWaze.onclick = function (e) { e.preventDefault(); Mapas.abrirWaze(dados.origem, dados.destino); };
      }

      if (el.form) el.form.style.display = 'none';
      if (el.cardResultado) {
        el.cardResultado.style.display = 'block';
        el.cardResultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      Som.tocarSucesso();
    },
    voltarFormulario: function (el) {
      if (!el) return;
      if (el.cardResultado) el.cardResultado.style.display = 'none';
      if (el.form) el.form.style.display = 'flex';
      if (el.erroMsg) Ui.limparErro(el.erroMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ==============================================================
  // API PÚBLICA
  // ==============================================================

  return { Auth: Auth, Api: Api, Format: Format, Mapas: Mapas, Som: Som, Ui: Ui, CONFIG: CONFIG };

})();
