export function renderNightView(container, audioGuide, selectedRoleIds, onFinishNight) {
  const scripts = audioGuide.generateNightScripts(selectedRoleIds);
  let currentIndex = 0;
  let isMuted = audioGuide.isMuted;

  function updateDOM() {
    const currentScript = scripts[currentIndex];

    container.innerHTML = `
      <div class="view-card night-card animate-fade-in">
        <div class="card-header">
          <span class="step-badge night-badge">🌙 NIGHT PHASE</span>
          <h2>밤 단계 진행가이드</h2>
          <p class="subtitle">사회자 음성 지시에 따라 눈을 감고 정체를 확인하세요.</p>
        </div>

        <div class="night-speaker-box">
          <div class="moon-pulse">🌙</div>
          <div class="night-script-display">
            <span class="script-step-num">단계 ${currentIndex + 1} / ${scripts.length}</span>
            <p class="script-text">"${currentScript ? currentScript.text : ''}"</p>
          </div>
        </div>

        <div class="night-controls">
          <button type="button" id="btn-toggle-sound" class="btn-secondary btn-icon-text">
            ${isMuted ? '🔇 음성 켜기' : '🔊 음성 끄기'}
          </button>
          
          <button type="button" id="btn-next-step" class="btn-primary">
            ▶ 다음 멘트
          </button>

          <button type="button" id="btn-skip-night" class="btn-outline">
            ⏩ 즉시 원정 시작
          </button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const soundBtn = container.querySelector('#btn-toggle-sound');
    if (soundBtn) {
      soundBtn.onclick = () => {
        isMuted = audioGuide.toggleMute();
        updateDOM();
      };
    }

    const nextBtn = container.querySelector('#btn-next-step');
    if (nextBtn) {
      nextBtn.onclick = () => {
        audioGuide.nextStepManually();
      };
    }

    const skipBtn = container.querySelector('#btn-skip-night');
    if (skipBtn) {
      skipBtn.onclick = () => {
        audioGuide.stop();
        onFinishNight();
      };
    }
  }

  // 자동 순차 진행 시작
  audioGuide.startScriptSequence(
    scripts,
    (index) => {
      currentIndex = index;
      updateDOM();
    },
    () => {
      // 모두 읽으면 밤 단계 종료 후 원정 뷰로
      onFinishNight();
    }
  );

  updateDOM();
}
