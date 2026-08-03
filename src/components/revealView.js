import { TEAM } from '../logic/constants.js';

export function renderRevealView(container, engine, onFinishReveal) {
  let isCardRevealed = false;

  function updateDOM() {
    const currentIndex = engine.revealPlayerIndex;
    const player = engine.players[currentIndex];
    const seenInfo = engine.getSeenInfoForPlayer(player);
    const isGood = player.role.team === TEAM.GOOD;

    container.innerHTML = `
      <div class="view-card reveal-card animate-fade-in">
        <div class="card-header">
          <span class="step-badge">단계 ${currentIndex + 1} / ${engine.players.length}</span>
          <h2>📱 패스 앤 플레이 (Pass & Play)</h2>
          <p class="subtitle">기기를 다른 플레이어가 보지 않도록 주의해서 전달해 주세요.</p>
        </div>

        <div class="pass-player-box">
          <div class="user-avatar">${player.name.charAt(0)}</div>
          <h3 class="current-player-name">${player.name} 님 차례입니다!</h3>
        </div>

        ${!isCardRevealed ? `
          <div class="shield-curtain">
            <p class="curtain-notice">⚠️ 본인만 화면을 볼 수 있도록 휴대폰/태블릿을 다잡은 뒤 아래 버튼을 누르세요.</p>
            <button type="button" id="btn-reveal-card" class="btn-primary btn-large glow-btn">
              👁️ 내 비밀 역할 확인하기
            </button>
          </div>
        ` : `
          <!-- 3D Flip Card -->
          <div class="role-card-display ${isGood ? 'card-good' : 'card-evil'} animate-flip-in">
            <div class="role-badge ${isGood ? 'good-bg' : 'evil-bg'}">
              ${isGood ? '정의의 세력 (Good)' : '악의 세력 (Evil)'}
            </div>

            <div class="role-main">
              <span class="role-icon-lg">${player.role.icon}</span>
              <h3 class="role-title">${player.role.name}</h3>
              <p class="role-description">${player.role.description}</p>
            </div>

            <!-- 시야 정보 (Mult-vision) -->
            <div class="seen-info-box">
              <h4>👁️ 밤 단계 시야 정보</h4>
              ${seenInfo.length > 0 ? `
                <ul class="seen-list">
                  ${seenInfo.map(item => `
                    <li>
                      <span class="seen-player-name">${item.name}</span>
                      <span class="seen-tag">${item.tag}</span>
                    </li>
                  `).join('')}
                </ul>
              ` : `
                <p class="seen-empty">주변에 확인할 수 있는 인물이 없습니다. (아무도 보이지 않음)</p>
              `}
            </div>
          </div>

          <div class="reveal-actions">
            <button type="button" id="btn-next-player" class="btn-success btn-large">
              ✅ 확인 완료 (${currentIndex < engine.players.length - 1 ? '다음 사람에게 전달' : '밤 단계로 이동'})
            </button>
          </div>
        `}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const revealBtn = container.querySelector('#btn-reveal-card');
    if (revealBtn) {
      revealBtn.onclick = () => {
        isCardRevealed = true;
        updateDOM();
      };
    }

    const nextBtn = container.querySelector('#btn-next-player');
    if (nextBtn) {
      nextBtn.onclick = () => {
        isCardRevealed = false;
        const hasMore = engine.nextRevealPlayer();
        if (hasMore) {
          updateDOM();
        } else {
          onFinishReveal();
        }
      };
    }
  }

  updateDOM();
}
