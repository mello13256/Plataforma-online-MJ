// Interface no ecrã: barras de vida/energia, frasco, almas, chefe, avisos, nome das áreas, bússola e mira.
import * as THREE from '../vendor/three.js';
import { ARMAS } from './dados.js';

const $ = (id) => document.getElementById(id);
const v3 = new THREE.Vector3();

export class Hud {
  constructor() {
    this.el = $('hud');
    this.hp = $('b-hp');
    this.en = $('b-en');
    this.chefe = $('chefe');
    this.tAviso = 0;
    this.tArea = 0;
    this.almasMostradas = 0;
    this.ganho = 0;
    this.tGanho = 0;
    this.barrasInimigos = [];
    const cont = $('barras-inimigos');
    for (let i = 0; i < 8; i++) {
      const b = document.createElement('div');
      b.className = 'barra-inimigo';
      b.innerHTML = '<div class="p"></div><div class="v"></div><span class="d"></span>';
      cont.appendChild(b);
      this.barrasInimigos.push(b);
    }
    // bússola
    this.faixa = $('bussola-faixa');
    const pontos = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]];
    this.marcasBussola = pontos.map(([t, a]) => {
      const s = document.createElement('span');
      s.textContent = t;
      if (t.length === 1) s.style.color = '#f0e2c0';
      else s.style.fontSize = '11px';
      this.faixa.appendChild(s);
      return { s, a };
    });
    this.marcasExtra = [];
  }

  mostrar(v) {
    this.el.classList.toggle('oculto', !v);
  }

  atualizar(dt, J, inimigos, camara, chefeAtivo) {
    // barras escalam com o máximo (como nos souls)
    const largHp = Math.min(innerWidth * 0.5, J.hpMax * 0.62);
    const largEn = Math.min(innerWidth * 0.4, J.energiaMax * 1.9);
    this.hp.style.width = `${largHp}px`;
    this.en.style.width = `${largEn}px`;
    this.hp.querySelector('.valor').style.transform = `scaleX(${Math.max(0, J.hp / J.hpMax)})`;
    this.hp.querySelector('.perda').style.transform = `scaleX(${Math.max(0, J.hpVisivel / J.hpMax)})`;
    this.en.querySelector('.valor').style.transform = `scaleX(${Math.max(0, J.energia / J.energiaMax)})`;
    $('n-frasco').textContent = J.frascos;
    $('ic-frasco').classList.toggle('vazio', J.frascos === 0);
    $('nome-arma').textContent = ARMAS[J.arma].nome;

    // almas a contar
    if (this.almasMostradas !== J.almas) {
      const d = J.almas - this.almasMostradas;
      this.almasMostradas += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 4)));
      if (Math.sign(J.almas - this.almasMostradas) !== Math.sign(d)) this.almasMostradas = J.almas;
    }
    $('n-almas').textContent = this.almasMostradas.toLocaleString('pt-PT');
    this.tGanho -= dt;
    $('almas-ganho').style.opacity = this.tGanho > 0 ? 1 : 0;

    // chefe
    if (chefeAtivo && chefeAtivo.vivo) {
      this.chefe.classList.add('visivel');
      $('chefe-nome').textContent = chefeAtivo.nome;
      this.chefe.querySelector('.valor').style.transform = `scaleX(${Math.max(0, chefeAtivo.hp / chefeAtivo.hpMax)})`;
      this.chefe.querySelector('.perda').style.transform = `scaleX(${Math.max(0, chefeAtivo.hpVisivel / chefeAtivo.hpMax)})`;
      $('chefe-dano').textContent = chefeAtivo.tDanoAcum > 0 ? Math.round(chefeAtivo.danoAcum) : '';
    } else {
      this.chefe.classList.remove('visivel');
    }

    // barras dos inimigos comuns
    let i = 0;
    const W = innerWidth, H = innerHeight;
    for (const ini of inimigos) {
      if (i >= this.barrasInimigos.length) break;
      if (!ini.vivo || ini.chefe || !ini.rig.raiz.visible) continue;
      const mostrar = ini.tDanoRecente > 0 || J.alvo === ini;
      if (!mostrar) continue;
      v3.set(ini.pos.x, ini.pos.y + ini.altura + 0.35, ini.pos.z).project(camara);
      if (v3.z > 1) continue;
      const b = this.barrasInimigos[i++];
      b.style.display = 'block';
      b.style.left = `${(v3.x * 0.5 + 0.5) * W}px`;
      b.style.top = `${(-v3.y * 0.5 + 0.5) * H}px`;
      b.querySelector('.v').style.transform = `scaleX(${Math.max(0, ini.hp / ini.hpMax)})`;
      b.querySelector('.p').style.transform = `scaleX(${Math.max(0, ini.hpVisivel / ini.hpMax)})`;
      b.querySelector('.d').textContent = ini.tDanoAcum > 0 ? Math.round(ini.danoAcum) : '';
    }
    for (; i < this.barrasInimigos.length; i++) this.barrasInimigos[i].style.display = 'none';

    // mira do alvo fixo
    const mira = $('mira');
    if (J.alvo && J.alvo.vivo) {
      const a = J.alvo;
      v3.set(a.pos.x, a.pos.y + a.altura * 0.6, a.pos.z).project(camara);
      mira.style.display = v3.z < 1 ? 'block' : 'none';
      mira.style.left = `${(v3.x * 0.5 + 0.5) * W}px`;
      mira.style.top = `${(-v3.y * 0.5 + 0.5) * H}px`;
    } else mira.style.display = 'none';

    this.tAviso -= dt;
    if (this.tAviso <= 0) $('aviso').style.opacity = 0;
    this.tArea -= dt;
    if (this.tArea <= 0) $('area').style.opacity = 0;
  }

  atualizarBussola(yaw, extras) {
    const rumo = (Math.atan2(Math.sin(yaw), -Math.cos(yaw)) * 180) / Math.PI;
    const larg = this.faixa.parentElement.clientWidth;
    const pxGrau = larg / 180;
    const colocar = (s, a) => {
      let d = a - rumo;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      if (Math.abs(d) > 95) {
        s.style.display = 'none';
        return;
      }
      s.style.display = 'block';
      s.style.left = `${larg / 2 + d * pxGrau}px`;
    };
    for (const m of this.marcasBussola) colocar(m.s, m.a);
    while (this.marcasExtra.length < extras.length) {
      const s = document.createElement('span');
      s.style.fontSize = '10px';
      this.faixa.appendChild(s);
      this.marcasExtra.push(s);
    }
    this.marcasExtra.forEach((s, i) => {
      const e = extras[i];
      if (!e) {
        s.style.display = 'none';
        return;
      }
      s.textContent = '◆';
      s.style.color = e.cor;
      s.style.top = '13px';
      colocar(s, e.ang);
    });
  }

  ganhoAlmas(n) {
    this.ganho = this.tGanho > 0 ? this.ganho + n : n;
    this.tGanho = 2.5;
    $('almas-ganho').textContent = `+${this.ganho.toLocaleString('pt-PT')}`;
  }

  aviso(texto, dur = 2.6) {
    const a = $('aviso');
    a.textContent = texto;
    a.style.opacity = 1;
    this.tAviso = dur;
  }

  area(nome) {
    $('area-nome').textContent = nome;
    $('area').style.opacity = 1;
    this.tArea = 3.5;
  }

  interacao(texto, tecla = 'E') {
    const el = $('interacao');
    if (!texto) {
      el.classList.add('oculto');
      return;
    }
    el.classList.remove('oculto');
    $('texto-int').textContent = texto;
    $('tecla-int').textContent = tecla;
  }
}
