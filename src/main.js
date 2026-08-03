import { api } from './api/firebaseApp.js';
import { generateRoles, initializePlayData, calculateTeamVoteResult, calculateQuestResult } from './logic/gameLogic.js';
import { ALIGNMENT_RATIO, ROLES } from './logic/constants.js';
import { generateMarkdownHistory } from './logic/markdownGen.js';

import { renderLobbyView } from './components/lobbyView.js';
import { renderHistoryView } from './components/historyView.js';
import { renderRoomView } from './components/roomView.js';
import { renderGamePhase } from './components/phaseViews.js';

const viewContainer = document.getElementById('view-container');
const headerStatus = document.querySelector('.header-phase-pill');
const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');

let appState = {
  view: 'lobby', // 'lobby', 'history', 'room', 'game'
  roomId: null,
  myUserId: null,
  myNickname: null,
  isHost: false,
  playersData: {},
  gameState: 'lobby',
  playData: null,
  historyItems: [],
  historyLastKey: null,
  hasMoreHistory: true,
  isLoadingHistory: false
};

let isProcessingTransition = false;
let heartbeatInterval = null;

function init() {
  api.cleanupOldRooms();
  
  // 세션 복구
  const savedSession = localStorage.getItem('avalon_session');
  if (savedSession) {
    const sessionData = JSON.parse(savedSession);
    api.getRoom(sessionData.roomId).then(room => {
      if (room && room.players && room.players[sessionData.userId]) {
        appState.roomId = sessionData.roomId;
        appState.myUserId = sessionData.userId;
        appState.myNickname = sessionData.nickname;
        startRoomSync();
      } else {
        localStorage.removeItem('avalon_session');
        renderLobby();
      }
    });
  } else {
    renderLobby();
  }
}

function updateHeader() {
  if (appState.view === 'lobby') headerStatus.innerText = '로비 (대기실)';
  else if (appState.view === 'history') headerStatus.innerText = '과거 기록 보관소';
  else if (appState.view === 'room') headerStatus.innerText = `접속 중 [${appState.roomId}]`;
  else headerStatus.innerText = `게임 진행 중 [${appState.roomId}]`;
}

// ========================
// Views Navigation
// ========================
function renderLobby() {
  appState.view = 'lobby';
  updateHeader();
  renderLobbyView(viewContainer, {
    onJoin: async (nickname, roomCode) => {
      const room = await api.getRoom(roomCode);
      if (!room) return alert("존재하지 않는 방입니다.");
      if (room.gameState !== 'lobby') return alert("이미 게임이 진행 중입니다.");
      
      const userId = 'p_' + Date.now() + Math.floor(Math.random()*1000);
      await api.joinRoom(roomCode, userId, nickname);
      
      localStorage.setItem('avalon_session', JSON.stringify({ roomId: roomCode, userId, nickname }));
      appState.roomId = roomCode;
      appState.myUserId = userId;
      appState.myNickname = nickname;
      startRoomSync();
    },
    onCreateRoom: (nickname) => {
      modalBody.innerHTML = `
        <h3 style="color: var(--gold-primary); margin-top:0;">방 생성 권한 확인</h3>
        <p style="font-size: 0.9rem; margin-bottom: 15px;">관리자 비밀번호를 입력하세요.</p>
        <input type="password" id="adminPwd" class="input-modern" style="text-align: center; letter-spacing: 5px;">
        <div class="action-row" style="margin-top: 15px;">
          <button id="btnConfirmPwd" class="btn-primary">확인</button>
          <button id="btnCancelPwd" class="btn-danger">취소</button>
        </div>
      `;
      modalOverlay.classList.remove('hidden');
      document.getElementById('btnCancelPwd').onclick = () => modalOverlay.classList.add('hidden');
      document.getElementById('btnConfirmPwd').onclick = async () => {
        const pwd = document.getElementById('adminPwd').value;
        const newCode = Math.floor(1000 + Math.random() * 9000).toString();
        const success = await api.createRoom(newCode, pwd);
        if (success) {
          modalOverlay.classList.add('hidden');
          
          // 방 생성 성공 즉시 방장으로 자동 접속
          const userId = 'p_' + Date.now() + Math.floor(Math.random()*1000);
          await api.joinRoom(newCode, userId, nickname);
          
          localStorage.setItem('avalon_session', JSON.stringify({ roomId: newCode, userId, nickname }));
          appState.roomId = newCode;
          appState.myUserId = userId;
          appState.myNickname = nickname;
          startRoomSync();
        } else {
          alert("방 생성에 실패했습니다. 비밀번호를 확인해주세요.");
        }
      };
    },
    onOpenHistory: () => {
      modalBody.innerHTML = `
        <h3 style="color: var(--gold-primary); margin-top:0;">게임 기록 조회 권한</h3>
        <p style="font-size: 0.9rem; margin-bottom: 15px;">관리자 비밀번호를 입력하세요.</p>
        <input type="password" id="historyPwd" class="input-modern" style="text-align: center; letter-spacing: 5px;">
        <div class="action-row" style="margin-top: 15px;">
          <button id="btnConfirmHistoryPwd" class="btn-primary">확인</button>
          <button id="btnCancelHistoryPwd" class="btn-danger">취소</button>
        </div>
      `;
      modalOverlay.classList.remove('hidden');
      
      document.getElementById('btnCancelHistoryPwd').onclick = () => modalOverlay.classList.add('hidden');
      document.getElementById('btnConfirmHistoryPwd').onclick = async () => {
        const pwd = document.getElementById('historyPwd').value;
        const isValid = await api.verifyAdmin(pwd);
        
        if (!isValid) {
          alert("비밀번호가 일치하지 않습니다.");
          return;
        }
        
        modalOverlay.classList.add('hidden');
        
        appState.view = 'history';
        updateHeader();
        
        appState.historyItems = [];
        appState.historyLastKey = null;
        appState.hasMoreHistory = true;
        appState.isLoadingHistory = false;

        const refreshHistoryView = (isInitial = false) => {
          if (appState.view !== 'history') return;
          renderHistoryView(viewContainer, appState.historyItems, {
            onClose: () => { appState.historyItems = []; renderLobby(); },
            onDelete: async (id) => {
              await api.deleteGameHistory(id);
              appState.historyItems = appState.historyItems.filter(([key]) => key !== id);
              refreshHistoryView(true); // 재렌더링
            },
            onLoadMore: async () => {
              if (appState.isLoadingHistory || !appState.hasMoreHistory) return;
              appState.isLoadingHistory = true;
              try {
                const data = await api.fetchHistoryPage(10, appState.historyLastKey);
                let entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
                if (appState.historyLastKey) {
                  entries = entries.filter(([key]) => key !== appState.historyLastKey);
                }
                if (entries.length === 0) {
                  appState.hasMoreHistory = false;
                } else {
                  entries.reverse(); // 내림차순 (최신순)
                  appState.historyLastKey = entries[entries.length - 1][0];
                  appState.historyItems.push(...entries);
                }
                refreshHistoryView(false); // isInitial = false (추가 렌더링)
              } finally {
                appState.isLoadingHistory = false;
              }
            },
            hasMore: appState.hasMoreHistory,
            isInitial: isInitial
          });
        };

      appState.isLoadingHistory = true;
      // 처음에 로딩 표시를 위해 빈 상태로 렌더링
      refreshHistoryView(true);
      
      try {
        const data = await api.fetchHistoryPage(10);
        let entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
        if (entries.length < 10) appState.hasMoreHistory = false;
        entries.reverse();
        if (entries.length > 0) {
          appState.historyLastKey = entries[entries.length - 1][0];
          appState.historyItems = entries;
        }
        refreshHistoryView(true);
      } catch (err) {
        console.error("Failed to fetch history:", err);
        alert("게임 기록을 불러오는 중 오류가 발생했습니다: " + err.message);
      } finally {
        appState.isLoadingHistory = false;
      }
      };
    }
  });
}

function startRoomSync() {
  api.unsubscribeAll();
  api.setupPresence(appState.roomId, appState.myUserId);

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (appState.roomId && appState.myUserId) api.updateHeartbeat(appState.roomId, appState.myUserId);
  }, 2500);

  api.subscribeToHost(appState.roomId, (hostId) => {
    appState.isHost = hostId === appState.myUserId;
    refreshCurrentView();
  });

  api.subscribeToPlayers(appState.roomId, (players) => {
    appState.playersData = players || {};
    api.claimHost(appState.roomId, appState.playersData.host, appState.myUserId, appState.playersData);
    
    // 만약 내가 방에서 튕겼다면 로비로 쫓겨남
    if (!appState.playersData[appState.myUserId]) {
      api.unsubscribeAll();
      localStorage.removeItem('avalon_session');
      renderLobby();
      return;
    }
    refreshCurrentView();
  });

  api.subscribeToGameState(appState.roomId, (state) => {
    if (!state) return;
    appState.gameState = state;
    appState.view = state === 'lobby' ? 'room' : 'game';
    
    if (state === 'game_over' && appState.isHost && appState.playData && !appState.playData.historySaved) {
      handleGameOver();
    }
    
    updateHeader();
    refreshCurrentView();
  });

  api.subscribeToPlayData(appState.roomId, (pData) => {
    appState.playData = pData;
    
    if (pData && appState.gameState !== 'lobby' && appState.isHost && !isProcessingTransition) {
      const total = pData.playerOrder?.length || 0;
      
      if (pData.confirmations && Object.keys(pData.confirmations).length === total) {
        isProcessingTransition = true;
        setTimeout(() => handlePhaseTransition(appState.gameState, pData), 1000);
      }
      else if (appState.gameState === 'team_voting' && pData.votes && Object.keys(pData.votes).length === total) {
        isProcessingTransition = true;
        setTimeout(() => processTeamVotes(), 500);
      }
      else if (appState.gameState === 'quest_voting' && pData.questVotes && pData.proposedTeam && Object.keys(pData.questVotes).length === pData.proposedTeam.length) {
        isProcessingTransition = true;
        setTimeout(() => processQuestVotes(), 1000);
      }
    }
    refreshCurrentView();
  });
}

function refreshCurrentView() {
  if (appState.view === 'room') {
    renderRoomView(viewContainer, appState.roomId, appState.myUserId, appState.playersData, appState.isHost, {
      onToggleReady: (val) => api.setPlayerReady(appState.roomId, appState.myUserId, val),
      onStartGame: async (options) => {
        const playerIds = Object.keys(appState.playersData).filter(id => appState.playersData[id].isOnline !== false);
        const playerCount = playerIds.length;
        
        // 정원 초과 검증
        const ratio = ALIGNMENT_RATIO[playerCount];
        const selectedEvilCount = (options.morgana ? 1 : 0) + (options.mordred ? 1 : 0) + (options.oberon ? 1 : 0) + 1; // 1은 필수 암살자
        const selectedGoodCount = (options.percival ? 1 : 0) + 1; // 1은 필수 멀린
        
        if (selectedEvilCount > ratio.evil) {
          alert(`직업 설정 오류: ${playerCount}인 게임의 악의 세력 정원은 ${ratio.evil}명입니다.\n(기본 암살자 포함 ${selectedEvilCount}명 선택됨)\n특수 직업을 줄여주세요.`);
          return;
        }
        if (selectedGoodCount > ratio.good) {
          alert(`직업 설정 오류: ${playerCount}인 게임의 선의 세력 정원은 ${ratio.good}명입니다.\n(기본 멀린 포함 ${selectedGoodCount}명 선택됨)\n특수 직업을 줄여주세요.`);
          return;
        }

        const roles = generateRoles(playerCount, options);
        
        for (let i=0; i<playerIds.length; i++) {
          await api.updateHeartbeat(appState.roomId, playerIds[i]); // 살려두기
          api.db && await api.updateHeartbeat(appState.roomId, playerIds[i]);
          // TODO : update player role securely
          appState.playersData[playerIds[i]].role = roles[i];
          await api.setPlayerReady(appState.roomId, playerIds[i], false); // reset ready
        }
        
        // Roles 업데이트
        const updates = {};
        playerIds.forEach((id, idx) => { updates[`rooms/${appState.roomId}/players/${id}/role`] = roles[idx]; });
        
        const newPlayData = initializePlayData(playerIds);
        
        if (api.db) {
          await api.updateRoot(updates);
        }
        await api.overwritePlayData(appState.roomId, newPlayData);
        await api.updateGameState(appState.roomId, 'team_selection');
      }
    });
  } else if (appState.view === 'game') {
    renderGamePhase(viewContainer, appState.gameState, appState.playData, appState.myUserId, appState.playersData, appState.isHost, {
      onSubmitTeam: (teamIds) => {
        const tlItem = { type: 'team_proposed', leaderId: appState.myUserId, team: teamIds, attempt: (appState.playData.voteTrack || 0) + 1 };
        const tl = [...(appState.playData.timeline || []), tlItem];
        api.updatePlayData(appState.roomId, { proposedTeam: teamIds, timeline: tl });
        api.updateGameState(appState.roomId, 'team_voting');
      },
      onTeamVote: (voteStr) => {
        api.updatePlayData(appState.roomId, { [`votes/${appState.myUserId}`]: voteStr });
      },
      onQuestVote: (voteStr) => {
        api.updatePlayData(appState.roomId, { [`questVotes/${appState.myUserId}`]: voteStr });
      },
      onConfirmResult: () => {
        api.submitConfirmation(appState.roomId, appState.myUserId);
      },
      onAssassinate: (targetId) => {
        const assassinId = appState.myUserId;
        const success = appState.playersData[targetId].role === ROLES.MERLIN;
        
        const updates = { assassinatedTarget: targetId };
        const tlItem = { type: 'assassination', assassinId, targetId, success };
        const tl = [...(appState.playData.timeline || []), tlItem];
        updates.timeline = tl;
        
        api.updatePlayData(appState.roomId, updates);
        api.updateGameState(appState.roomId, 'game_over');
      },
      onRestart: () => {
        handleRestart();
      }
    });
  }
}

// ========================
// State Transitions (Host Only)
// ========================

async function processTeamVotes() {
  const pData = appState.playData;
  const result = calculateTeamVoteResult(pData.votes);
  
  const tlItem = { type: 'team_voted', passed: result.passed, approve: result.approve, reject: result.reject, votes: pData.votes };
  const tl = [...(pData.timeline || []), tlItem];
  
  const updates = { lastVoteResult: result, confirmations: {}, timeline: tl };
  if (!result.passed) {
    updates.voteTrack = (pData.voteTrack || 0) + 1;
  }
  
  await api.updatePlayData(appState.roomId, updates);
  await api.updateGameState(appState.roomId, 'vote_result');
  isProcessingTransition = false;
}

async function processQuestVotes() {
  const pData = appState.playData;
  const result = calculateQuestResult(Object.values(pData.questVotes), pData.currentQuest, pData.playerOrder.length);
  
  const qResults = [...(pData.questResults || [])];
  const qDetails = [...(pData.questDetails || [])];
  
  qResults.push(result.successStatus);
  qDetails.push({ s: result.successCount, f: result.failCount });
  
  const tlItem = { type: 'quest_result', result: result.successStatus, successCount: result.successCount, failCount: result.failCount };
  const tl = [...(pData.timeline || []), tlItem];
  
  await api.updatePlayData(appState.roomId, {
    lastQuestResult: result, confirmations: {},
    questResults: qResults, questDetails: qDetails,
    timeline: tl
  });
  await api.updateGameState(appState.roomId, 'quest_result');
  isProcessingTransition = false;
}

async function handlePhaseTransition(currentState, pData) {
  if (currentState === 'vote_result') {
    if (pData.lastVoteResult.passed) {
      await api.updatePlayData(appState.roomId, { questVotes: null, confirmations: null });
      await api.updateGameState(appState.roomId, 'quest_voting');
    } else {
      if (pData.voteTrack >= 5) {
        await api.updateGameState(appState.roomId, 'game_over');
      } else {
        const nextLeader = (pData.leaderIndex + 1) % pData.playerOrder.length;
        await api.updatePlayData(appState.roomId, { leaderIndex: nextLeader, proposedTeam: null, votes: null, confirmations: null });
        await api.updateGameState(appState.roomId, 'team_selection');
      }
    }
  } else if (currentState === 'quest_result') {
    const failsCount = (pData.questResults || []).filter(r => r === 'fail').length;
    const succCount = (pData.questResults || []).filter(r => r === 'success').length;
    
    if (failsCount >= 3) {
      await api.updateGameState(appState.roomId, 'game_over');
    } else if (succCount >= 3) {
      await api.updateGameState(appState.roomId, 'assassin_phase');
    } else {
      const nextLeader = (pData.leaderIndex + 1) % pData.playerOrder.length;
      await api.updatePlayData(appState.roomId, {
        currentQuest: pData.currentQuest + 1,
        leaderIndex: nextLeader,
        voteTrack: 0,
        proposedTeam: null, votes: null, questVotes: null, confirmations: null
      });
      
      const tlItem = { type: 'quest_start', round: pData.currentQuest + 2 };
      await api.updatePlayData(appState.roomId, { timeline: [...(pData.timeline||[]), tlItem] });
      await api.updateGameState(appState.roomId, 'team_selection');
    }
  }
  isProcessingTransition = false;
}

async function handleGameOver() {
  if (appState.playData && appState.playData.historySaved) return;
  
  const md = generateMarkdownHistory(appState.roomId, appState.playersData, appState.playData);
  const now = new Date();
  
  await api.saveGameHistory({
    roomId: appState.roomId,
    date: now.toLocaleDateString('ko-KR') + ' ' + now.toLocaleTimeString('ko-KR'),
    markdown: md
  });
  
  await api.updatePlayData(appState.roomId, { historySaved: true });
}

async function handleRestart() {
  Object.keys(appState.playersData).forEach(id => {
    api.setPlayerReady(appState.roomId, id, false);
  });
  await api.updateGameState(appState.roomId, 'lobby');
}

// Start
document.addEventListener('DOMContentLoaded', init);
