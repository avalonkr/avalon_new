import { PLAYER_RATIOS, DEFAULT_NAMES } from '../logic/constants.js';

export function renderSetupView(container, onStartGame) {
  let playerCount = 7;
  let playerNames = DEFAULT_NAMES.slice(0, playerCount);
  let selectedRoles = {
    PERCIVAL: true,
    MORGANA: true,
    MODRED: true,
    OBERON: false
  };

  function updateDOM() {
    const ratio = PLAYER_RATIOS[playerCount];

    container.innerHTML = `
      <div class="view-card setup-card animate-fade-in">
        <div class="card-header">
          <h2>🛡️ 아발론 게임 설정</h2>
          <p class="subtitle">참여할 플레이어 수와 특수 역할을 선택하세요.</p>
        </div>

        <!-- 1. 플레이어 수 선택 -->
        <div class="section-block">
          <label class="section-title">👥 플레이어 수 선택 (${playerCount}명)</label>
          <div class="player-count-selector">
            ${[5, 6, 7, 8, 9, 10].map(n => `
              <button type="button" class="btn-count ${n === playerCount ? 'active' : ''}" data-count="${n}">
                ${n}인
              </button>
            `).join('')}
          </div>
          <div class="ratio-badge">
            <span class="badge-good">선 진영 <strong>${ratio.good}명</strong></span>
            <span class="badge-vs">VS</span>
            <span class="badge-evil">악 진영 <strong>${ratio.evil}명</strong></span>
          </div>
        </div>

        <!-- 2. 특수 역할 구성 선택 -->
        <div class="section-block">
          <label class="section-title">✨ 특수 역할 구성</label>
          <div class="roles-grid">
            <label class="role-toggle-item disabled">
              <input type="checkbox" checked disabled />
              <div class="role-info">
                <span class="role-name good-text">🧙‍♂️ 멀린 (필수)</span>
                <span class="role-desc">모드레드 제외 모든 악 확인</span>
              </div>
            </label>

            <label class="role-toggle-item disabled">
              <input type="checkbox" checked disabled />
              <div class="role-info">
                <span class="role-name evil-text">🗡️ 어쌔신 (필수)</span>
                <span class="role-desc">멀린 지정 암살 시도</span>
              </div>
            </label>

            <label class="role-toggle-item">
              <input type="checkbox" id="role-percival" ${selectedRoles.PERCIVAL ? 'checked' : ''} />
              <div class="role-info">
                <span class="role-name good-text">🛡️ 퍼시벌 (선)</span>
                <span class="role-desc">멀린 & 모르가나 후보 확인</span>
              </div>
            </label>

            <label class="role-toggle-item">
              <input type="checkbox" id="role-morgana" ${selectedRoles.MORGANA ? 'checked' : ''} />
              <div class="role-info">
                <span class="role-name evil-text">🔮 모르가나 (악)</span>
                <span class="role-desc">퍼시벌에게 멀린 위장</span>
              </div>
            </label>

            <label class="role-toggle-item">
              <input type="checkbox" id="role-modred" ${selectedRoles.MODRED ? 'checked' : ''} />
              <div class="role-info">
                <span class="role-name evil-text">👑 모드레드 (악)</span>
                <span class="role-desc">멀린 시야에 미노출</span>
              </div>
            </label>

            <label class="role-toggle-item">
              <input type="checkbox" id="role-oberon" ${selectedRoles.OBERON ? 'checked' : ''} />
              <div class="role-info">
                <span class="role-name evil-text">🎭 오베론 (악)</span>
                <span class="role-desc">악 동료를 서로 모름</span>
              </div>
            </label>
          </div>
        </div>

        <!-- 3. 플레이어 이름 입력 -->
        <div class="section-block">
          <div class="section-header-flex">
            <label class="section-title">✏️ 플레이어 닉네임 입력</label>
            <button type="button" id="btn-random-names" class="btn-secondary btn-sm">🎲 랜덤 이름 채우기</button>
          </div>
          <div class="names-grid">
            ${Array.from({ length: playerCount }).map((_, i) => `
              <div class="name-input-group">
                <span class="player-num-tag">${i + 1}</span>
                <input type="text" class="input-name" data-index="${i}" value="${playerNames[i] || `플레이어${i + 1}`}" placeholder="플레이어 ${i + 1}" maxLength="10" />
              </div>
            `).join('')}
          </div>
        </div>

        <div class="setup-actions">
          <button type="button" id="btn-start-game" class="btn-primary btn-large">
            ⚔️ 아발론 원정 시작하기
          </button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // 인원수 변경
    container.querySelectorAll('.btn-count').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const count = parseInt(e.currentTarget.dataset.count, 10);
        playerCount = count;
        // 기존 이름 보존 + 필요시 채우기
        if (playerNames.length < count) {
          while (playerNames.length < count) {
            playerNames.push(DEFAULT_NAMES[playerNames.length] || `플레이어${playerNames.length + 1}`);
          }
        } else {
          playerNames = playerNames.slice(0, count);
        }
        updateDOM();
      });
    });

    // 특수 역할 체크박스
    const percivalCb = container.querySelector('#role-percival');
    const morganaCb = container.querySelector('#role-morgana');
    const modredCb = container.querySelector('#role-modred');
    const oberonCb = container.querySelector('#role-oberon');

    if (percivalCb) percivalCb.onchange = (e) => { selectedRoles.PERCIVAL = e.target.checked; };
    if (morganaCb) morganaCb.onchange = (e) => { selectedRoles.MORGANA = e.target.checked; };
    if (modredCb) modredCb.onchange = (e) => { selectedRoles.MODRED = e.target.checked; };
    if (oberonCb) oberonCb.onchange = (e) => { selectedRoles.OBERON = e.target.checked; };

    // 이름 입력 이벤트
    container.querySelectorAll('.input-name').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        playerNames[idx] = e.target.value.trim() || `플레이어${idx + 1}`;
      });
    });

    // 랜덤 이름 버튼
    const randomBtn = container.querySelector('#btn-random-names');
    if (randomBtn) {
      randomBtn.onclick = () => {
        const shuffled = [...DEFAULT_NAMES].sort(() => Math.random() - 0.5);
        playerNames = shuffled.slice(0, playerCount);
        updateDOM();
      };
    }

    // 시작 버튼
    const startBtn = container.querySelector('#btn-start-game');
    if (startBtn) {
      startBtn.onclick = () => {
        // 이름 유효성
        const finalNames = playerNames.map((n, idx) => n.trim() || `플레이어${idx + 1}`);
        onStartGame(finalNames, selectedRoles);
      };
    }
  }

  updateDOM();
}
