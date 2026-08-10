// src/components/phases/QuestVoting.js
import { ROLES } from '../../logic/constants.js';

export function renderQuestVoting(playData, myUserId, playersData) {
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

export function bindQuestVotingEvents(callbacks) {
  const btnSuccess = document.getElementById('btnQuestSuccess');
  const btnFail = document.getElementById('btnQuestFail');
  
  function containerHideAction(...btns) {
    btns.forEach(b => { if(b) b.style.display = 'none'; });
    const box = document.querySelector('.phase-box');
    if (box) box.innerHTML += `<p class="good-text">투표 제출 완료. 다른 대원을 기다립니다.</p>`;
  }

  if (btnSuccess) btnSuccess.onclick = () => { 
    callbacks.onQuestVote('success'); 
    containerHideAction(btnSuccess, btnFail); 
  };
  if (btnFail) btnFail.onclick = () => { 
    callbacks.onQuestVote('fail'); 
    containerHideAction(btnSuccess, btnFail); 
  };
}
