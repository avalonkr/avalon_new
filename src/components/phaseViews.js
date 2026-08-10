import { getRoleTag } from '../logic/gameLogic.js';
import { ROLES, QUEST_CAPACITY } from '../logic/constants.js';

export function renderGamePhase(container, gameState, playData, myUserId, playersData, isHost, myDecryptedRole, myDecryptedSecrets, callbacks) {
  const myRole = myDecryptedRole || playersData[myUserId]?.role || '???';
  const isPendingConfirm = playData.confirmations && !playData.confirmations[myUserId];
  const totalPlayers = playData.playerOrder.length;

  let content = `
    <div class="view-card game-card animate-fade-in">
      ${renderRoleHeader(myRole, myDecryptedSecrets)}
      ${renderScoreboard(playData, totalPlayers, playersData)}
      ${renderPhaseContent(gameState, playData, myUserId, playersData, isHost, myRole, callbacks)}
    </div>
  `;
  container.innerHTML = content;
  
  bindPhaseEvents(gameState, playData, myUserId, playersData, isHost, myRole, callbacks);
}

function renderRoleHeader(myRole, secretList) {
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

function renderScoreboard(playData, totalPlayers, playersData) {
  let html = `<div class="scoreboard-bar"><div class="rounds-tracker">`;
  const results = playData.questResults || [];
  const details = playData.questDetails || [];
  
  for(let i=0; i<5; i++) {
    const qSize = QUEST_CAPACITY[totalPlayers][i];
    const failReq = (totalPlayers >= 7 && i === 3) ? 2 : 1;
    const result = results[i];
    const detail = details[i];
    
    let statusClass = 'pending';
    let icon = `${qSize}인`;
    let detailHtml = failReq === 2 ? `<span class="fails-tag" style="color: var(--evil-red);">(실패 2 이상)</span>` : '';
    
    if (result === 'success' || result === 'fail') {
      statusClass = result === 'success' ? 'good-win' : 'evil-win';
      icon = result === 'success' ? '🔵' : '🔴';
      detailHtml = `<span class="fails-tag" style="color: var(--text-main);">${detail.s}🔵 ${detail.f}🔴</span>`;
    }
    else if (i === playData.currentQuest) { 
      statusClass = 'active'; 
    }
    
    html += `
      <div class="round-badge ${statusClass}">
        <span class="round-num">${i+1}R</span>
        <span class="round-icon">${icon}</span>
        ${detailHtml}
      </div>
    `;
  }
  html += `</div></div>`;
  
  const shiftedOrder = [];
  const totalCount = playData.playerOrder.length;
  for (let j = 0; j < totalCount; j++) {
    const actualIndex = (playData.leaderIndex + j) % totalCount;
    shiftedOrder.push({ id: playData.playerOrder[actualIndex], isCurrent: j === 0 });
  }

  html += `
    <div class="leader-info-strip" style="flex-direction: column; align-items: stretch; gap: 10px;">
      <div style="display: flex; justify-content: space-between; width: 100%;">
        <div class="leader-badge"><span>원정대장 로테이션 순서</span></div>
        <div class="rejection-tracker ${playData.voteTrack >= 4 ? 'warn' : ''}">현재 부결: <b>${playData.voteTrack} / 5</b></div>
      </div>
      <div class="leader-order-strip" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 5px; font-size: 0.75rem; scrollbar-width: none;">
        ${shiftedOrder.map(item => {
          const name = playersData[item.id].nickname;
          return `<div style="padding: 4px 8px; border-radius: 4px; white-space: nowrap; ${item.isCurrent ? 'background: var(--gold-primary); color: #000; font-weight: bold;' : 'background: rgba(255,255,255,0.1); color: var(--text-muted);'}">${item.isCurrent ? '👑 ' : ''}${name}</div>`;
        }).join('<span style="color: rgba(255,255,255,0.2); align-self: center;">▶</span>')}
      </div>
    </div>
  `;
  return html;
}

function renderPhaseContent(gameState, playData, myUserId, playersData, isHost, callbacks) {
  const isLeader = playData.playerOrder[playData.leaderIndex] === myUserId;
  const currentQuestSize = QUEST_CAPACITY[playData.playerOrder.length][playData.currentQuest];
  
  if (gameState === 'team_selection') {
    return `
      <div class="phase-box">
        <h3>원정대 구성 ( ${currentQuestSize}명 필요 )</h3>
        ${isLeader ? `
          <p class="subtitle">당신은 원정대장입니다. 대원을 지목하세요.</p>
          <div id="teamSelectionGrid" class="selection-grid">
            ${playData.playerOrder.map(id => `
              <label class="select-label"><input type="checkbox" value="${id}" class="team-checkbox"> ${playersData[id].nickname}</label>
            `).join('')}
          </div>
          <div style="text-align: center; margin-top: 25px;">
            <button id="submitTeamBtn" class="btn-primary btn-large" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;" disabled>원정대 구성 완료</button>
          </div>
        ` : `
          <p class="subtitle">대장이 원정대원을 고르고 있습니다. 대기해주세요.</p>
        `}
      </div>
    `;
  }

  if (gameState === 'team_voting') {
    return `
      <div class="phase-box">
        <h3>🗳️ 원정대 찬반 투표</h3>
        <p>제안된 원정대: <b>${playData.proposedTeam.map(id => playersData[id].nickname).join(', ')}</b></p>
        <div class="action-row" style="margin-top: 20px; gap: 15px; display: flex;">
          <button id="btnVoteApprove" class="btn-success" style="padding: 20px 10px; font-size: 1.2rem; flex: 1;">👍 찬성</button>
          <button id="btnVoteReject" class="btn-danger" style="padding: 20px 10px; font-size: 1.2rem; flex: 1;">👎 반대</button>
        </div>
        <p id="voteWaitText" style="margin-top: 10px; color: var(--text-muted); display: none;">투표 완료. 다른 플레이어를 기다립니다...</p>
      </div>
    `;
  }
  
  if (gameState === 'vote_result' || gameState === 'quest_result') {
    return renderConfirmBox(gameState, playData, myUserId, playersData, isHost);
  }

  if (gameState === 'quest_voting') {
    const isMyTurn = playData.proposedTeam.includes(myUserId);
    const myRole = playersData[myUserId].role;
    const isEvil = [ROLES.ASSASSIN, ROLES.MORGANA, ROLES.MODRED, ROLES.OBERON, ROLES.MINION].includes(myRole);
    
    if (isMyTurn) {
      return `
        <div class="phase-box" style="border: 1px solid var(--good-blue);">
          <h3>⚔️ 비밀 원정 수행</h3>
          <p class="subtitle">결과를 신중하게 선택하세요.</p>
          <div class="action-row" style="margin-top: 20px; display: flex; gap: 15px;">
            <button id="btnQuestSuccess" class="btn-success btn-large" style="flex: 1; padding: 20px 10px;">🔵 성공 제출</button>
            <button id="btnQuestFail" class="btn-danger btn-large" style="flex: 1; padding: 20px 10px;" ${!isEvil ? 'disabled' : ''}>🔴 실패 제출</button>
          </div>
        </div>
      `;
    } else {
      return `<div class="phase-box"><p class="subtitle">원정대원들이 기밀 임무를 수행 중입니다...</p></div>`;
    }
  }

  if (gameState === 'assassin_phase') {
    const isAssassin = playersData[myUserId].role === ROLES.ASSASSIN;
    return `
      <div class="phase-box" style="border-color: var(--danger);">
        <h3 class="evil-text">🗡️ 암살자 단계</h3>
        ${isAssassin ? `
          <p>당신은 어쌔신입니다. 멀린을 지목하세요!</p>
          <select id="assassinTargetSelect" class="input-modern">
            <option value="">대상을 선택하세요</option>
            ${playData.playerOrder.map(id => {
              const targetRole = playersData[id].role;
              const evilRoles = [ROLES.ASSASSIN, ROLES.MORGANA, ROLES.MODRED, ROLES.OBERON, ROLES.MINION];
              if (evilRoles.includes(targetRole)) return '';
              return `<option value="${id}">${playersData[id].nickname}</option>`;
            }).join('')}
          </select>
          <div style="text-align: center; margin-top: 25px;">
            <button id="btnAssassinate" class="btn-danger btn-large" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;">암살 실행</button>
          </div>
        ` : `<p>어쌔신이 멀린을 암살하려 합니다. 대기하세요...</p>`}
      </div>
    `;
  }

  if (gameState === 'game_over') {
    const target = playData.assassinatedTarget;
    let winText = "";
    if (playData.voteTrack >= 5) winText = "투표 5연속 부결: 악 진영 승리!";
    else if ((playData.questResults||[]).filter(r=>r==='fail').length >= 3) winText = "원정 3회 실패: 악 진영 승리!";
    else if (target) {
      if (playersData[target].role === ROLES.MERLIN) winText = `멀린 암살 성공(${playersData[target].nickname}): 악 진영 역전승!`;
      else winText = `멀린 암살 실패(${playersData[target].nickname}): 선 진영 승리!`;
    } else winText = "선 진영 최종 승리!";
    
    return `
      <div class="phase-box">
        <h2 style="color: var(--gold-primary);">🏆 게임 종료</h2>
        <h3 style="margin-bottom: 20px;">${winText}</h3>
        <ul style="text-align: left; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
          ${playData.playerOrder.map(id => `
            <li>${playersData[id].nickname} - <b>${playersData[id].role}</b></li>
          `).join('')}
        </ul>
        ${isHost ? `
          <div style="text-align: center; margin-top: 25px;">
            <button id="btnRestartGame" class="btn-primary btn-large glow-btn" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;">새 게임 준비 (대기실)</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `<div>Loading...</div>`;
}

function renderConfirmBox(gameState, playData, myUserId, playersData, isHost) {
  const isConfirmed = playData.confirmations && playData.confirmations[myUserId];
  const unconfirmed = playData.playerOrder.filter(id => !playData.confirmations || !playData.confirmations[id]);
  const uNames = unconfirmed.map(id => playersData[id].nickname).join(', ');
  
  let headerHtml = "";
  if (gameState === 'vote_result') {
    const isPassed = playData.lastVoteResult.passed;
    headerHtml = `
      <h3>투표 결과: ${isPassed ? '<span class="good-text">승인됨</span>' : '<span class="evil-text">부결됨</span>'}</h3>
      <p>찬성 ${playData.lastVoteResult.approve} / 반대 ${playData.lastVoteResult.reject}</p>
    `;
  } else if (gameState === 'quest_result') {
    const isSuccess = playData.lastQuestResult.successStatus === 'success';
    headerHtml = `
      <h3>원정 결과: ${isSuccess ? '<span class="good-text">성공</span>' : '<span class="evil-text">실패</span>'}</h3>
      <p>성공 카드 ${playData.lastQuestResult.successCount}장 / 실패 카드 ${playData.lastQuestResult.failCount}장</p>
    `;
  }

  return `
    <div class="phase-box confirm-box">
      ${headerHtml}
      <hr style="border-color: #333; margin: 15px 0;">
      ${isConfirmed 
        ? `<p class="good-text">다른 플레이어를 기다리는 중입니다... (${playData.playerOrder.length - unconfirmed.length}/${playData.playerOrder.length})</p>
           <p class="evil-text" style="font-size: 0.8rem; margin-top: 5px;">미확인: ${uNames}</p>`
        : `<div style="text-align: center;">
             <button id="btnConfirmPhase" class="btn-primary btn-large glow-btn" style="width: 100%; max-width: 300px; padding: 15px 0; font-size: 1.1rem;">결과 확인 완료</button>
           </div>
           <p class="evil-text" style="font-size: 0.8rem; margin-top: 10px;">미확인: ${uNames}</p>`
      }
    </div>
  `;
}

function bindPhaseEvents(gameState, playData, myUserId, playersData, isHost, callbacks) {
  // 역할 토글
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

  // 팀 구성
  if (gameState === 'team_selection') {
    const checkboxes = document.querySelectorAll('.team-checkbox');
    const submitBtn = document.getElementById('submitTeamBtn');
    if (submitBtn) {
      const required = QUEST_CAPACITY[playData.playerOrder.length][playData.currentQuest];
      
      const updateSubmitBtn = () => {
        const checked = document.querySelectorAll('.team-checkbox:checked').length;
        const btn = document.getElementById('submitTeamBtn');
        if (btn) btn.disabled = checked !== required;
      };
      
      checkboxes.forEach(cb => {
        cb.addEventListener('change', updateSubmitBtn);
        cb.addEventListener('click', updateSubmitBtn);
      });
      
      // 혹시 이미 체크된 요소가 있을 경우를 대비한 초기화
      updateSubmitBtn();
      submitBtn.onclick = () => {
        const teamIds = Array.from(document.querySelectorAll('.team-checkbox:checked')).map(cb => cb.value);
        callbacks.onSubmitTeam(teamIds);
      };
    }
  }

  // 찬반 투표
  if (gameState === 'team_voting') {
    const btnApprove = document.getElementById('btnVoteApprove');
    const btnReject = document.getElementById('btnVoteReject');
    const waitText = document.getElementById('voteWaitText');
    if (btnApprove) btnApprove.onclick = () => { callbacks.onTeamVote('approve'); btnApprove.disabled=true; btnReject.disabled=true; waitText.style.display='block'; };
    if (btnReject) btnReject.onclick = () => { callbacks.onTeamVote('reject'); btnApprove.disabled=true; btnReject.disabled=true; waitText.style.display='block'; };
  }

  // 원정 투표
  if (gameState === 'quest_voting') {
    const btnSuccess = document.getElementById('btnQuestSuccess');
    const btnFail = document.getElementById('btnQuestFail');
    if (btnSuccess) btnSuccess.onclick = () => { callbacks.onQuestVote('success'); containerHideAction(btnSuccess, btnFail); };
    if (btnFail) btnFail.onclick = () => { callbacks.onQuestVote('fail'); containerHideAction(btnSuccess, btnFail); };
  }

  // 결과 수동 확인 (공통)
  if (gameState === 'vote_result' || gameState === 'quest_result') {
    const btnConfirm = document.getElementById('btnConfirmPhase');
    if (btnConfirm) btnConfirm.onclick = () => callbacks.onConfirmResult();
  }

  // 암살
  if (gameState === 'assassin_phase') {
    const btnAss = document.getElementById('btnAssassinate');
    const selAss = document.getElementById('assassinTargetSelect');
    if (btnAss) {
      btnAss.onclick = () => {
        if (selAss.value) callbacks.onAssassinate(selAss.value);
      };
    }
  }

  // 리스타트
  if (gameState === 'game_over') {
    const btnRestart = document.getElementById('btnRestartGame');
    if (btnRestart) btnRestart.onclick = () => callbacks.onRestart();
  }
}

function containerHideAction(...btns) {
  btns.forEach(b => { if(b) b.style.display = 'none'; });
  document.querySelector('.phase-box').innerHTML += `<p class="good-text">투표 제출 완료. 다른 대원을 기다립니다.</p>`;
}
