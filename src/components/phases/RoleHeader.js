import { ROLES } from '../../logic/constants.js';

export function renderRoleHeader(myRole, secretList) {
  let roleDesc = "";
  let teamClass = "good-text";
  if (myRole === ROLES.MERLIN) roleDesc = "모드레드를 제외한 악을 압니다. 암살에 주의하세요.";
  else if (myRole === ROLES.PERCIVAL) roleDesc = "멀린과 모르가나를 봅니다. 구분은 할 수 없습니다.";
  else if (myRole === ROLES.ASSASSIN) { roleDesc = "오베론 제외 악을 압니다. 마지막에 멀린을 암살하세요."; teamClass = "evil-text"; }
  else if (myRole === ROLES.MORGANA) { roleDesc = "퍼시벌에게 멀린으로 위장합니다. 오베론 제외 악을 압니다."; teamClass = "evil-text"; }
  else if (myRole === ROLES.MODRED) { roleDesc = "멀린에게 보이지 않습니다. 오베론 제외 악을 압니다."; teamClass = "evil-text"; }
  else if (myRole === ROLES.OBERON) { roleDesc = "다른 악을 모르며 당신도 알려지지 않습니다."; teamClass = "evil-text"; }
  else if (myRole === ROLES.MINION) { roleDesc = "오베론 제외 악을 압니다."; teamClass = "evil-text"; }
  else roleDesc = "대화와 투표를 통해 악을 추리하세요.";

  const sList = secretList || [];

  return `
    <div class="role-summary-panel">
      <div class="role-header" style="justify-content: center; position: relative;">
        <span>당신의 정체는</span>
        <button id="toggleRoleBtn" class="btn-secondary" style="margin-top: 10px;">👀 내 정체 확인하기</button>
        <h2 id="myRoleDisplay" class="${teamClass}" style="display: none; margin-top: 10px;">${myRole}</h2>
      </div>
      <div id="roleDetailsArea" style="display: none;">
        <p class="role-desc">${roleDesc}</p>
        ${sList.length > 0 ? `
          <div class="secret-info-box">
            <h4 class="evil-text">⚠️ 기밀 정보 (시야)</h4>
            <ul>${sList.map(s => `<li>${s}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function bindRoleHeaderEvents() {
  const toggleBtn = document.getElementById('toggleRoleBtn');
  const roleDisplay = document.getElementById('myRoleDisplay');
  const roleDetails = document.getElementById('roleDetailsArea');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const isHidden = roleDisplay.style.display === 'none';
      if (isHidden) {
        roleDisplay.style.display = 'block';
        roleDetails.style.display = 'block';
        toggleBtn.innerText = '🙈 정체 숨기기';
      } else {
        roleDisplay.style.display = 'none';
        roleDetails.style.display = 'none';
        toggleBtn.innerText = '👀 내 정체 확인하기';
      }
    };
  }
}
