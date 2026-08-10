import { generateRoles, initializePlayData, calculateTeamVoteResult, calculateQuestResult } from './gameLogic.js';
import { ALIGNMENT_RATIO, ROLES } from './constants.js';
import { generateMarkdownHistory } from './markdownGen.js';
import * as cryptoUtils from './crypto.js';

export class GameController {
  constructor(api, getAppState) {
    this.api = api;
    this.getAppState = getAppState; // () => appState
  }

  async startGame(options) {
    const appState = this.getAppState();
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
    
    for (let i = 0; i < playerIds.length; i++) {
      await this.api.updateHeartbeat(appState.roomId, playerIds[i]); 
      this.api.db && await this.api.updateHeartbeat(appState.roomId, playerIds[i]);
      await this.api.setPlayerReady(appState.roomId, playerIds[i], false); 
    }
    
    const updates = {};
    const hostEncryptedRoles = {};
    
    for (let i = 0; i < playerIds.length; i++) {
      const pId = playerIds[i];
      const role = roles[i];
      let secretList = [];
      const isEvil = [ROLES.ASSASSIN, ROLES.MORGANA, ROLES.MODRED, ROLES.OBERON, ROLES.MINION].includes(role);
      
      for (let j = 0; j < playerIds.length; j++) {
        if (i === j) continue;
        const targetId = playerIds[j];
        const targetRole = roles[j];
        const targetP = appState.playersData[targetId];
        const targetIsEvil = [ROLES.ASSASSIN, ROLES.MORGANA, ROLES.MODRED, ROLES.OBERON, ROLES.MINION].includes(targetRole);
        
        if (role === ROLES.MERLIN) {
          if (targetIsEvil && targetRole !== ROLES.MODRED) secretList.push(`😈 <b>${targetP.nickname}</b> (악)`);
        } else if (role === ROLES.PERCIVAL) {
          if (targetRole === ROLES.MERLIN || targetRole === ROLES.MORGANA) secretList.push(`🧙‍♂️ <b>${targetP.nickname}</b> (멀린 또는 모르가나)`);
        } else if (isEvil && role !== ROLES.OBERON) {
          if (targetIsEvil && targetRole !== ROLES.OBERON) secretList.push(`🤝 <b>${targetP.nickname}</b> (같은 편)`);
        }
      }
      
      const payload = { role, secretList };
      const pubKeyPem = appState.playersData[pId].publicKey;
      if (pubKeyPem) {
        const encryptedPayload = await cryptoUtils.encryptData(pubKeyPem, payload);
        updates[`rooms/${appState.roomId}/players/${pId}/encryptedRole`] = encryptedPayload;
      }
      hostEncryptedRoles[pId] = role;
      updates[`rooms/${appState.roomId}/players/${pId}/role`] = null; // Remove plaintext role
    }
    
    const newPlayData = initializePlayData(playerIds);
    
    if (appState.cryptoKeyPair) {
      const myPubKeyPem = await cryptoUtils.exportPublicKey(appState.cryptoKeyPair.publicKey);
      const hostBackup = await cryptoUtils.encryptData(myPubKeyPem, hostEncryptedRoles);
      newPlayData.hostBackupRoles = hostBackup;
    }
    
    if (this.api.db) {
      await this.api.updateRoot(updates);
    }
    await this.api.overwritePlayData(appState.roomId, newPlayData);
    await this.api.updateGameState(appState.roomId, 'team_selection');
  }

  async processTeamVotes() {
    const appState = this.getAppState();
    const pData = appState.playData;
    const result = calculateTeamVoteResult(pData.votes);
    
    const tlItem = { type: 'team_voted', passed: result.passed, approve: result.approve, reject: result.reject, votes: pData.votes };
    const tl = [...(pData.timeline || []), tlItem];
    
    const updates = { lastVoteResult: result, confirmations: {}, timeline: tl };
    if (!result.passed) {
      updates.voteTrack = (pData.voteTrack || 0) + 1;
    }
    
    await this.api.updatePlayData(appState.roomId, updates);
    await this.api.updateGameState(appState.roomId, 'vote_result');
  }

  async processQuestVotes() {
    const appState = this.getAppState();
    const pData = appState.playData;
    
    const decryptedVotesObj = {};
    const rawVotes = [];
    if (appState.cryptoKeyPair) {
      for (const [vId, encVote] of Object.entries(pData.questVotes || {})) {
        if (typeof encVote === 'object' && encVote.encryptedAesKey) {
          const decryptedVoteStr = await cryptoUtils.decryptData(appState.cryptoKeyPair.privateKey, encVote);
          if (decryptedVoteStr) {
            decryptedVotesObj[vId] = decryptedVoteStr;
            rawVotes.push(decryptedVoteStr);
          }
        } else {
          // Fallback for legacy plaintext games
          decryptedVotesObj[vId] = encVote;
          rawVotes.push(encVote);
        }
      }
    }
    
    const result = calculateQuestResult(rawVotes, pData.currentQuest, pData.playerOrder.length);
    
    const qResults = [...(pData.questResults || [])];
    const qDetails = [...(pData.questDetails || [])];
    
    qResults.push(result.successStatus);
    qDetails.push({ s: result.successCount, f: result.failCount });
    
    const tlItem = { 
      type: 'quest_result', 
      result: result.successStatus, 
      successCount: result.successCount, 
      failCount: result.failCount,
      questVotes: pData.questVotes 
    };
    const tl = [...(pData.timeline || []), tlItem];
    
    await this.api.updatePlayData(appState.roomId, {
      lastQuestResult: result, confirmations: {},
      questResults: qResults, questDetails: qDetails,
      timeline: tl
    });
    await this.api.updateGameState(appState.roomId, 'quest_result');
  }

  async handlePhaseTransition(currentState, pData) {
    const appState = this.getAppState();
    if (currentState === 'vote_result') {
      if (pData.lastVoteResult.passed) {
        await this.api.updatePlayData(appState.roomId, { questVotes: null, confirmations: null });
        await this.api.updateGameState(appState.roomId, 'quest_voting');
      } else {
        if (pData.voteTrack >= 5) {
          await this.api.updateGameState(appState.roomId, 'game_over');
        } else {
          const nextLeader = (pData.leaderIndex + 1) % pData.playerOrder.length;
          await this.api.updatePlayData(appState.roomId, { leaderIndex: nextLeader, proposedTeam: null, votes: null, confirmations: null });
          await this.api.updateGameState(appState.roomId, 'team_selection');
        }
      }
    } else if (currentState === 'quest_result') {
      const failsCount = (pData.questResults || []).filter(r => r === 'fail').length;
      const succCount = (pData.questResults || []).filter(r => r === 'success').length;
      
      if (failsCount >= 3) {
        await this.api.updateGameState(appState.roomId, 'game_over');
      } else if (succCount >= 3) {
        await this.api.updateGameState(appState.roomId, 'assassin_phase');
      } else {
        const nextLeader = (pData.leaderIndex + 1) % pData.playerOrder.length;
        await this.api.updatePlayData(appState.roomId, {
          currentQuest: pData.currentQuest + 1,
          leaderIndex: nextLeader,
          voteTrack: 0,
          proposedTeam: null, votes: null, questVotes: null, confirmations: null
        });
        
        const tlItem = { type: 'quest_start', round: pData.currentQuest + 2 };
        await this.api.updatePlayData(appState.roomId, { timeline: [...(pData.timeline||[]), tlItem] });
        await this.api.updateGameState(appState.roomId, 'team_selection');
      }
    }
  }

  async handleGameOver() {
    const appState = this.getAppState();
    if (appState.playData && appState.playData.historySaved) return;
    
    let rolesForHistory = {};
    if (appState.playData.hostBackupRoles && appState.cryptoKeyPair) {
      const decrypted = await cryptoUtils.decryptData(appState.cryptoKeyPair.privateKey, appState.playData.hostBackupRoles);
      if (decrypted) {
        rolesForHistory = decrypted;
      }
    }

    const fakePlayersData = JSON.parse(JSON.stringify(appState.playersData));
    for (const pId in fakePlayersData) {
      if (rolesForHistory[pId]) fakePlayersData[pId].role = rolesForHistory[pId];
      else fakePlayersData[pId].role = '??? (복호화 불가)';
    }

    const fakePlayData = JSON.parse(JSON.stringify(appState.playData));
    const decryptedTimeline = fakePlayData.timeline || [];
    if (appState.cryptoKeyPair) {
      for (let evt of decryptedTimeline) {
        if (evt.type === 'quest_result' && evt.questVotes) {
          const decryptedQVotes = {};
          for (const [vId, encVote] of Object.entries(evt.questVotes)) {
            if (typeof encVote === 'object' && encVote.encryptedAesKey) {
              const dVote = await cryptoUtils.decryptData(appState.cryptoKeyPair.privateKey, encVote);
              if (dVote) decryptedQVotes[vId] = dVote;
            } else {
              decryptedQVotes[vId] = encVote;
            }
          }
          evt.questVotes = decryptedQVotes;
        }
      }
    }
    fakePlayData.timeline = decryptedTimeline;

    const md = generateMarkdownHistory(appState.roomId, fakePlayersData, fakePlayData);
    const now = new Date();
    
    await this.api.saveGameHistory({
      roomId: appState.roomId,
      date: now.toLocaleDateString('ko-KR') + ' ' + now.toLocaleTimeString('ko-KR'),
      markdown: md
    });
    
    await this.api.updatePlayData(appState.roomId, { historySaved: true });
  }
}
