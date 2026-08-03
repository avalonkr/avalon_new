import { TEAM } from '../logic/constants.js';

export function renderGameOverView(container, engine, onRestartGame) {
  const isGoodWinner = engine.winner === TEAM.GOOD;

  container.innerHTML = `
    <div class="view-card gameover-card animate-fade-in">
      <div class="winner-banner ${isGoodWinner ? 'banner-good' : 'banner-evil'}">
        <div class="winner-trophy">${isGoodWinner ? '🛡️' : '🗡️'}</div>
        <h1 class="winner-title">${isGoodWinner ? '정의의 세력 승리!' : '악의 세력 승리!'}</h1>
        <p class="winner-reason">"${engine.winReason}"</p>
      </div>

      <!-- 플레이어 전체 정체 공개 -->
      <div class="all-roles-reveal-box">
        <h3>📜 아발론 기사단 정체 공개</h3>
        <div class="roles-table-grid">
          ${engine.players.map(player => {
            const isGood = player.role.team === TEAM.GOOD;
            const isAssassinated = engine.assassinatedTarget && engine.assassinatedTarget.id === player.id;

            return `
              <div class="player-role-card ${isGood ? 'card-good-border' : 'card-evil-border'}">
                <div class="player-identity">
                  <span class="player-avatar-sm">${player.name.charAt(0)}</span>
                  <span class="player-name-bold">${player.name}</span>
                  ${isAssassinated ? '<span class="assassinated-badge">🎯 암살 지목됨</span>' : ''}
                </div>
                <div class="role-reveal-badge ${isGood ? 'good-text' : 'evil-text'}">
                  ${player.role.icon} ${player.role.name}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 원정 히스토리 보고서 -->
      <div class="history-summary-box">
        <h3>📊 원정 히스토리</h3>
        <div class="history-list">
          ${engine.questResults.map(q => `
            <div class="history-item ${q.success ? 'hist-good' : 'hist-evil'}">
              <span class="hist-round">${q.round}라운드</span>
              <span class="hist-status">${q.success ? '🔵 성공' : '🔴 실패'}</span>
              <span class="hist-details">리더: ${q.leader} | 대원: [ ${q.team.join(', ')} ] (성공 ${q.votes.success} / 실패 ${q.votes.fail})</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="gameover-actions">
        <button type="button" id="btn-restart-game" class="btn-primary btn-large glow-btn">
          🔄 새로운 게임 시작하기
        </button>
      </div>
    </div>
  `;

  const restartBtn = container.querySelector('#btn-restart-game');
  if (restartBtn) {
    restartBtn.onclick = () => {
      onRestartGame();
    };
  }
}
