import { GameEngine } from './logic/gameState.js';
import { AudioGuideController } from './logic/audioGuide.js';
import { GAME_PHASE } from './logic/constants.js';

import { renderSetupView } from './components/setupView.js';
import { renderRevealView } from './components/revealView.js';
import { renderNightView } from './components/nightView.js';
import { renderQuestView } from './components/questView.js';
import { renderAssassinView } from './components/assassinView.js';
import { renderGameOverView } from './components/gameOverView.js';

class AvalonApp {
  constructor() {
    this.engine = new GameEngine();
    this.audioGuide = new AudioGuideController();
    
    this.viewContainer = document.getElementById('view-container');
    this.headerStatus = document.getElementById('header-status');
    this.footerActions = document.getElementById('footer-actions');
    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalBody = document.getElementById('modal-body');
    this.modalCloseBtn = document.getElementById('modal-close-btn');

    this.selectedRoleIds = {};

    this.init();
  }

  init() {
    this.setupFooterControls();
    this.setupModalEvents();
    this.renderCurrentView();
  }

  setupFooterControls() {
    this.footerActions.innerHTML = `
      <button type="button" id="btn-rules" class="btn-secondary btn-sm">📜 게임 룰북</button>
      <button type="button" id="btn-reset" class="btn-outline btn-sm">🔄 게임 리셋</button>
    `;

    document.getElementById('btn-rules').onclick = () => this.showRulesModal();
    document.getElementById('btn-reset').onclick = () => {
      if (confirm('정말로 진행 중인 게임을 처음으로 리셋하시겠습니까?')) {
        this.audioGuide.stop();
        this.engine.reset();
        this.renderCurrentView();
      }
    };
  }

  setupModalEvents() {
    if (this.modalCloseBtn) {
      this.modalCloseBtn.onclick = () => {
        this.modalOverlay.classList.add('hidden');
      };
    }
    if (this.modalOverlay) {
      this.modalOverlay.onclick = (e) => {
        if (e.target === this.modalOverlay) {
          this.modalOverlay.classList.add('hidden');
        }
      };
    }
  }

  showRulesModal() {
    this.modalBody.innerHTML = `
      <h2 style="color: var(--gold-primary); margin-bottom: 12px;">📜 레지스탕스 아발론 룰 요약</h2>
      <div style="font-size: 0.9rem; line-height: 1.6; color: var(--text-primary);">
        <p style="margin-bottom: 10px;"><strong>목표:</strong> 정의의 세력은 원정 3회 성공 + 멀린 보존, 악의 세력은 원정 3회 실패 OR 5연속 부결 OR 멀린 암살 성공 시 승리합니다.</p>
        
        <h4 style="color: var(--gold-primary); margin-top: 14px;">👥 특수 역할 가이드</h4>
        <ul style="margin-left: 20px; margin-bottom: 10px;">
          <li><strong>🧙‍♂️ 멀린 (선):</strong> 모드레드를 제외한 모든 악을 알고 있음.</li>
          <li><strong>🛡️ 퍼시벌 (선):</strong> 멀린과 모르가나를 봄 (구분 불가).</li>
          <li><strong>🗡️ 어쌔신 (악):</strong> 선 3승 시 멀린을 맞추면 악 승리.</li>
          <li><strong>🔮 모르가나 (악):</strong> 퍼시벌에게 멀린인 것처럼 위장.</li>
          <li><strong>👑 모드레드 (악):</strong> 멀린 시야에 보이지 않음.</li>
          <li><strong>🎭 오베론 (악):</strong> 다른 악과 서로 모름.</li>
        </ul>

        <h4 style="color: var(--gold-primary); margin-top: 14px;">🎯 4라운드 특수 룰</h4>
        <p>7인 이상 플레이 시, 4라운드 원정은 실패 카드가 <strong>2장 이상</strong> 제출되어야만 원정이 실패합니다.</p>
      </div>
    `;
    this.modalOverlay.classList.remove('hidden');
  }

  renderHeaderStatus() {
    let text = '';
    switch (this.engine.phase) {
      case GAME_PHASE.SETUP:
        text = '게임 세팅';
        break;
      case GAME_PHASE.ROLE_REVEAL:
        text = `역할 확인 (${this.engine.revealPlayerIndex + 1}/${this.engine.players.length})`;
        break;
      case GAME_PHASE.NIGHT_PHASE:
        text = '🌙 밤 단계 진행 중';
        break;
      case GAME_PHASE.QUEST_BUILDING:
      case GAME_PHASE.TEAM_VOTE:
      case GAME_PHASE.QUEST_VOTE:
        text = `⚔️ ${this.engine.currentRound}라운드 원정`;
        break;
      case GAME_PHASE.ASSASSINATION:
        text = '🗡️ 어쌔신의 암살 시도';
        break;
      case GAME_PHASE.GAME_OVER:
        text = '🏆 게임 종료';
        break;
    }

    this.headerStatus.innerHTML = `<span class="header-phase-pill">${text}</span>`;
  }

  renderCurrentView() {
    this.renderHeaderStatus();
    this.viewContainer.innerHTML = '';

    switch (this.engine.phase) {
      case GAME_PHASE.SETUP:
        renderSetupView(this.viewContainer, (playerNames, selectedRoles) => {
          this.selectedRoleIds = selectedRoles;
          this.engine.startNewGame(playerNames, selectedRoles);
          this.renderCurrentView();
        });
        break;

      case GAME_PHASE.ROLE_REVEAL:
        renderRevealView(this.viewContainer, this.engine, () => {
          this.renderCurrentView();
        });
        break;

      case GAME_PHASE.NIGHT_PHASE:
        renderNightView(this.viewContainer, this.audioGuide, this.selectedRoleIds, () => {
          this.engine.finishNightPhase();
          this.renderCurrentView();
        });
        break;

      case GAME_PHASE.QUEST_BUILDING:
      case GAME_PHASE.TEAM_VOTE:
      case GAME_PHASE.QUEST_VOTE:
        renderQuestView(this.viewContainer, this.engine, () => {
          this.renderCurrentView();
        });
        break;

      case GAME_PHASE.ASSASSINATION:
        renderAssassinView(this.viewContainer, this.engine, () => {
          this.renderCurrentView();
        });
        break;

      case GAME_PHASE.GAME_OVER:
        renderGameOverView(this.viewContainer, this.engine, () => {
          this.engine.reset();
          this.renderCurrentView();
        });
        break;
    }
  }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
  new AvalonApp();
});
