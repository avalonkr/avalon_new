import { ROLES, TEAM, PLAYER_RATIOS, QUEST_CONFIG, GAME_PHASE } from './constants.js';

export class GameEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = GAME_PHASE.SETUP;
    this.players = [];            // [{ id, name, role, isLeader }]
    this.currentLeaderIndex = 0;
    this.currentRound = 1;         // 1 ~ 5
    this.rejectionCount = 0;       // 0 ~ 5 (5연속 부결 시 악 승리)
    this.questResults = [];        // [{ round: 1, success: true, leader: 'A', team: ['A', 'B'], votes: {success: 2, fail: 0} }]
    
    this.goodScore = 0;
    this.evilScore = 0;

    // 현재 라운드 구성 중인 원정대원 ID 배열
    this.selectedTeamIds = [];

    // 현재 플레이어 패스앤플레이 확인 관련 인덱스
    this.revealPlayerIndex = 0;

    // 최종 결과
    this.winner = null; // TEAM.GOOD or TEAM.EVIL
    this.winReason = '';
    this.assassinatedTarget = null;
    this.isMerlinAssassinated = false;
  }

  // 배열 셔플 (Fisher-Yates)
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 게임 시작 & 역할 분배
   * @param {string[]} playerNames - 플레이어 이름 배열 (5 ~ 10명)
   * @param {Object} selectedRoleIds - 사용자 선택 특수 역할 객체 { PERCIVAL: true, MORGANA: true, ... }
   */
  startNewGame(playerNames, selectedRoleIds = {}) {
    this.reset();

    const count = playerNames.length;
    if (count < 5 || count > 10) {
      throw new Error('플레이어 수는 5명에서 10명 사이여야 합니다.');
    }

    const ratio = PLAYER_RATIOS[count];
    const rolesToAssign = [];

    // 1. 선 진영 역할 채우기
    rolesToAssign.push(ROLES.MERLIN); // 멀린 필수
    if (selectedRoleIds.PERCIVAL) {
      rolesToAssign.push(ROLES.PERCIVAL);
    }
    while (rolesToAssign.filter(r => r.team === TEAM.GOOD).length < ratio.good) {
      rolesToAssign.push(ROLES.SERVANT);
    }

    // 2. 악 진영 역할 채우기
    rolesToAssign.push(ROLES.ASSASSIN); // 어쌔신 필수
    if (selectedRoleIds.MORGANA) {
      rolesToAssign.push(ROLES.MORGANA);
    }
    if (selectedRoleIds.MODRED) {
      rolesToAssign.push(ROLES.MODRED);
    }
    if (selectedRoleIds.OBERON) {
      rolesToAssign.push(ROLES.OBERON);
    }
    while (rolesToAssign.filter(r => r.team === TEAM.EVIL).length < ratio.evil) {
      rolesToAssign.push(ROLES.MINION);
    }

    // rolesToAssign 수 검증 (선/악 비율 초과 시 오류 방지 처리)
    let goodRoles = rolesToAssign.filter(r => r.team === TEAM.GOOD);
    let evilRoles = rolesToAssign.filter(r => r.team === TEAM.EVIL);

    // 만약 특수역할을 너무 많이 선택해서 비율보다 크면 일반 역할로 조정
    if (goodRoles.length > ratio.good) {
      goodRoles = goodRoles.slice(0, ratio.good);
    }
    if (evilRoles.length > ratio.evil) {
      evilRoles = evilRoles.slice(0, ratio.evil);
    }

    const finalRoles = this.shuffle([...goodRoles, ...evilRoles]);
    const shuffledNames = this.shuffle(playerNames);

    this.players = shuffledNames.map((name, index) => ({
      id: `p_${index}_${Date.now()}`,
      name,
      role: finalRoles[index],
      isLeader: false
    }));

    // 첫 리더 무작위 지정
    this.currentLeaderIndex = Math.floor(Math.random() * this.players.length);
    this.players[this.currentLeaderIndex].isLeader = true;

    this.phase = GAME_PHASE.ROLE_REVEAL;
    this.revealPlayerIndex = 0;
  }

  /**
   * 특정 플레이어가 밤 단계/카드 확인 시 볼 수 있는 정보 반환
   * @param {Object} player 
   */
  getSeenInfoForPlayer(player) {
    const roleId = player.role.id;
    const seen = [];

    if (roleId === ROLES.MERLIN.id) {
      // 멀린: 모드레드를 제외한 모든 악
      this.players.forEach(p => {
        if (p.id !== player.id && p.role.team === TEAM.EVIL && p.role.id !== ROLES.MODRED.id) {
          seen.push({ name: p.name, tag: '악의 세력' });
        }
      });
    } else if (roleId === ROLES.PERCIVAL.id) {
      // 퍼시벌: 멀린과 모르가나 (구분 불가)
      this.players.forEach(p => {
        if (p.id !== player.id && (p.role.id === ROLES.MERLIN.id || p.role.id === ROLES.MORGANA.id)) {
          seen.push({ name: p.name, tag: '멀린 또는 모르가나' });
        }
      });
    } else if (player.role.team === TEAM.EVIL && roleId !== ROLES.OBERON.id) {
      // 일반 악 (오베론 제외): 오베론 제외 악 세력 동료 확인
      this.players.forEach(p => {
        if (p.id !== player.id && p.role.team === TEAM.EVIL && p.role.id !== ROLES.OBERON.id) {
          seen.push({ name: p.name, tag: '악의 동료' });
        }
      });
    }

    return seen;
  }

  /**
   * 다음 플레이어로 역할 확인 진행
   */
  nextRevealPlayer() {
    if (this.revealPlayerIndex < this.players.length - 1) {
      this.revealPlayerIndex++;
      return true;
    } else {
      // 역할 확인 모두 완료 후 밤 단계 진행
      this.phase = GAME_PHASE.NIGHT_PHASE;
      return false;
    }
  }

  finishNightPhase() {
    this.phase = GAME_PHASE.QUEST_BUILDING;
    this.selectedTeamIds = [];
  }

  /**
   * 현재 라운드의 원정 필요 인원 수 및 4라운드 2패 정보
   */
  getCurrentQuestConfig() {
    const totalCount = this.players.length;
    return QUEST_CONFIG[totalCount][this.currentRound - 1];
  }

  /**
   * 원정대원 토글 선택
   */
  toggleTeamMember(playerId) {
    if (this.phase !== GAME_PHASE.QUEST_BUILDING) return;
    
    const config = this.getCurrentQuestConfig();
    const idx = this.selectedTeamIds.indexOf(playerId);
    
    if (idx >= 0) {
      this.selectedTeamIds.splice(idx, 1);
    } else {
      if (this.selectedTeamIds.length < config.count) {
        this.selectedTeamIds.push(playerId);
      }
    }
  }

  /**
   * 원정대원 선출 확정 및 찬반 투표 단계로 이동
   */
  submitTeamSelection() {
    const config = this.getCurrentQuestConfig();
    if (this.selectedTeamIds.length !== config.count) {
      throw new Error(`원정대원 ${config.count}명을 정확히 선택해야 합니다.`);
    }
    this.phase = GAME_PHASE.TEAM_VOTE;
  }

  /**
   * 찬반 투표 제출 처리
   * @param {Object} votesMap - { playerId: true(찬성) / false(반대) }
   */
  submitTeamVote(votesMap) {
    if (this.phase !== GAME_PHASE.TEAM_VOTE) return;

    let approveCount = 0;
    let rejectCount = 0;

    Object.values(votesMap).forEach(isApprove => {
      if (isApprove) approveCount++;
      else rejectCount++;
    });

    const isPassed = approveCount > rejectCount; // 가반수 초과 승인

    if (isPassed) {
      // 부결 횟수 리셋 후 원정 비밀 투표 단계 진행
      this.rejectionCount = 0;
      this.phase = GAME_PHASE.QUEST_VOTE;
      return { passed: true, approveCount, rejectCount };
    } else {
      // 부결 처리
      this.rejectionCount++;
      
      // 5연속 부결 시 즉시 악 승리!
      if (this.rejectionCount >= 5) {
        this.winner = TEAM.EVIL;
        this.winReason = '원정대 구성이 5연속 부결되어 악의 세력이 승리했습니다!';
        this.phase = GAME_PHASE.GAME_OVER;
        return { passed: false, approveCount, rejectCount, gameOver: true };
      }

      // 다음 리더에게 넘김
      this.rotateLeader();
      this.selectedTeamIds = [];
      this.phase = GAME_PHASE.QUEST_BUILDING;
      return { passed: false, approveCount, rejectCount, gameOver: false };
    }
  }

  /**
   * 원정 성패 비밀 투표 처리
   * @param {boolean[]} questVotes - 각 원정대원이 낸 비밀 카드 [true, false, true...]
   */
  submitQuestVote(questVotes) {
    if (this.phase !== GAME_PHASE.QUEST_VOTE) return;

    const config = this.getCurrentQuestConfig();
    let failCards = 0;
    let successCards = 0;

    questVotes.forEach(isSuccess => {
      if (isSuccess) successCards++;
      else failCards++;
    });

    // 4라운드 2패 요구 여부 고려하여 성패 계산
    const isSuccess = failCards < config.failsNeeded;

    if (isSuccess) {
      this.goodScore++;
    } else {
      this.evilScore++;
    }

    this.questResults.push({
      round: this.currentRound,
      success: isSuccess,
      leader: this.players[this.currentLeaderIndex].name,
      team: this.selectedTeamIds.map(id => this.players.find(p => p.id === id).name),
      votes: { success: successCards, fail: failCards },
      failsNeeded: config.failsNeeded
    });

    // 승패 체크
    if (this.goodScore >= 3) {
      // 선 3승 달성 -> 어쌔신의 멀린 암살 단계로 이동!
      this.phase = GAME_PHASE.ASSASSINATION;
    } else if (this.evilScore >= 3) {
      // 악 3승 달성 -> 악 승리!
      this.winner = TEAM.EVIL;
      this.winReason = '원정 3회 실패로 악의 세력이 승리했습니다!';
      this.phase = GAME_PHASE.GAME_OVER;
    } else {
      // 다음 라운드 진행
      this.currentRound++;
      this.rotateLeader();
      this.selectedTeamIds = [];
      this.phase = GAME_PHASE.QUEST_BUILDING;
    }

    return { isSuccess, successCards, failCards };
  }

  /**
   * 어쌔신의 멀린 암살 시도
   * @param {string} targetPlayerId 
   */
  assassinate(targetPlayerId) {
    if (this.phase !== GAME_PHASE.ASSASSINATION) return;

    const target = this.players.find(p => p.id === targetPlayerId);
    this.assassinatedTarget = target;

    if (target.role.id === ROLES.MERLIN.id) {
      // 멀린 맞춤 -> 악 승리
      this.isMerlinAssassinated = true;
      this.winner = TEAM.EVIL;
      this.winReason = `어쌔신이 멀린(${target.name})을 정확히 암살하여 악의 세력이 역전 승리하였습니다!`;
    } else {
      // 멀린 맞추지 못함 -> 선 승리
      this.isMerlinAssassinated = false;
      this.winner = TEAM.GOOD;
      this.winReason = `어쌔신의 암살 시도가 실패하여(${target.name}는 멀린이 아님), 정의의 세력이 완벽히 승리했습니다!`;
    }

    this.phase = GAME_PHASE.GAME_OVER;
  }

  /**
   * 리더 다음 사람으로 넘기기
   */
  rotateLeader() {
    this.players[this.currentLeaderIndex].isLeader = false;
    this.currentLeaderIndex = (this.currentLeaderIndex + 1) % this.players.length;
    this.players[this.currentLeaderIndex].isLeader = true;
  }

  getCurrentLeader() {
    return this.players[this.currentLeaderIndex];
  }
}
