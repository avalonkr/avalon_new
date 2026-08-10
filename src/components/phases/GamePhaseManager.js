// src/components/phases/GamePhaseManager.js
import { renderRoleHeader, bindRoleHeaderEvents } from './RoleHeader.js';
import { renderScoreboard } from './Scoreboard.js';
import { renderTeamSelection, bindTeamSelectionEvents } from './TeamSelection.js';
import { renderTeamVoting, bindTeamVotingEvents } from './TeamVoting.js';
import { renderQuestVoting, bindQuestVotingEvents } from './QuestVoting.js';
import { renderConfirmBox, bindConfirmBoxEvents } from './ConfirmBox.js';
import { renderAssassin, bindAssassinEvents } from './Assassin.js';
import { renderGameOver, bindGameOverEvents } from './GameOver.js';

let htmlCache = {
  header: '',
  scoreboard: '',
  content: ''
};

export function renderGamePhase(container, gameState, playData, myUserId, playersData, isHost, myDecryptedRole, myDecryptedSecrets, callbacks) {
  const myRole = myDecryptedRole || playersData[myUserId]?.role || '???';
  const totalPlayers = playData.playerOrder.length;

  // 1. 컨테이너 뼈대 초기화 (최초 1회만 DOM 파괴)
  if (!container.querySelector('.game-phase-wrapper')) {
    container.innerHTML = `
      <div class="view-card game-card animate-fade-in game-phase-wrapper">
        <div id="ph-header-container"></div>
        <div id="ph-scoreboard-container"></div>
        <div id="ph-content-container"></div>
      </div>
    `;
    htmlCache = { header: '', scoreboard: '', content: '' };
  }

  // 2. 각 영역별 HTML 문자열 생성
  const headerHtml = renderRoleHeader(myRole, myDecryptedSecrets);
  const scoreboardHtml = renderScoreboard(playData, totalPlayers, playersData);
  const contentHtml = renderPhaseContent(gameState, playData, myUserId, playersData, isHost, myRole);

  // 3. String Compare를 통한 선택적 렌더링 (DOM 파괴 방지)
  const hContainer = document.getElementById('ph-header-container');
  if (hContainer && htmlCache.header !== headerHtml) {
    hContainer.innerHTML = headerHtml;
    htmlCache.header = headerHtml;
    bindRoleHeaderEvents();
  }

  const sContainer = document.getElementById('ph-scoreboard-container');
  if (sContainer && htmlCache.scoreboard !== scoreboardHtml) {
    sContainer.innerHTML = scoreboardHtml;
    htmlCache.scoreboard = scoreboardHtml;
  }

  const cContainer = document.getElementById('ph-content-container');
  if (cContainer && htmlCache.content !== contentHtml) {
    cContainer.innerHTML = contentHtml;
    htmlCache.content = contentHtml;
    // content가 렌더링될 때만 이벤트를 다시 바인딩합니다. 
    // 내부에서 수동 DOM 조작(containerHideAction 등)이 발생해도, 
    // 서버에서 받은 상태 기반 contentHtml 문자열이 동일하다면 이 구문은 실행되지 않으므로 수동 조작이 유지됩니다.
    bindPhaseContentEvents(gameState, playData, myUserId, playersData, callbacks);
  }
}

function renderPhaseContent(gameState, playData, myUserId, playersData, isHost, myRole) {
  if (gameState === 'team_selection') return renderTeamSelection(playData, playersData, myUserId);
  if (gameState === 'team_voting') return renderTeamVoting(playData, myUserId, playersData);
  if (gameState === 'vote_result' || gameState === 'quest_result') return renderConfirmBox(gameState, playData, myUserId, playersData, isHost);
  if (gameState === 'quest_voting') return renderQuestVoting(playData, myUserId, playersData);
  if (gameState === 'assassin_phase') return renderAssassin(playData, playersData, myRole);
  if (gameState === 'game_over') return renderGameOver(playData, playersData, isHost);
  return `<div>Loading...</div>`;
}

function bindPhaseContentEvents(gameState, playData, myUserId, playersData, callbacks) {
  if (gameState === 'team_selection') bindTeamSelectionEvents(playData, callbacks);
  if (gameState === 'team_voting') bindTeamVotingEvents(callbacks);
  if (gameState === 'vote_result' || gameState === 'quest_result') bindConfirmBoxEvents(callbacks);
  if (gameState === 'quest_voting') bindQuestVotingEvents(callbacks);
  if (gameState === 'assassin_phase') bindAssassinEvents(callbacks);
  if (gameState === 'game_over') bindGameOverEvents(callbacks);
}
