export function renderAssassinView(container, engine, onFinishAssassination) {
  let selectedTargetId = null;

  function updateDOM() {
    const assassin = engine.players.find(p => p.role.id === 'ASSASSIN') || { name: '어쌔신' };

    container.innerHTML = `
      <div class="view-card assassin-card animate-fade-in">
        <div class="card-header">
          <span class="step-badge assassin-badge">🗡️ ASSASSIN PHASE</span>
          <h2>최후의 암살 시도</h2>
          <p class="subtitle">선 진영이 원정 3회 성공에 성공했습니다! 어쌔신은 진짜 <strong>멀린</strong>을 지목하세요.</p>
        </div>

        <div class="assassin-notice-box">
          <div class="dagger-pulse">🗡️</div>
          <p class="assassin-instruction">
            어쌔신 <strong>[ ${assassin.name} ]</strong> 님은 악의 동료들과 상의한 후, 진짜 멀린이라고 생각하는 플레이어를 한 명 선택하세요.
            <br/><span class="warn-gold">※ 멀린 지정 성공 시 악 역전 승리! 실패 시 선 완승!</span>
          </p>
        </div>

        <div class="target-selection-grid">
          ${engine.players.map(player => {
            const isSelected = selectedTargetId === player.id;
            return `
              <button type="button" class="target-player-btn ${isSelected ? 'selected' : ''}" data-player-id="${player.id}">
                <span class="player-avatar">${player.name.charAt(0)}</span>
                <span class="player-name">${player.name}</span>
                ${isSelected ? '<span class="target-crosshair">🎯</span>' : ''}
              </button>
            `;
          }).join('')}
        </div>

        <div class="phase-actions">
          <button type="button" id="btn-strike-assassinate" class="btn-danger btn-large glow-danger ${!selectedTargetId ? 'disabled' : ''}" ${!selectedTargetId ? 'disabled' : ''}>
            🗡️ 암살 단검 실행하기
          </button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll('.target-player-btn').forEach(btn => {
      btn.onclick = (e) => {
        selectedTargetId = e.currentTarget.dataset.playerId;
        updateDOM();
      };
    });

    const strikeBtn = container.querySelector('#btn-strike-assassinate');
    if (strikeBtn) {
      strikeBtn.onclick = () => {
        if (selectedTargetId) {
          engine.assassinate(selectedTargetId);
          onFinishAssassination();
        }
      };
    }
  }

  updateDOM();
}
