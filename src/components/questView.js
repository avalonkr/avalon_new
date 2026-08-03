import { GAME_PHASE, QUEST_CONFIG, TEAM } from '../logic/constants.js';

export function renderQuestView(container, engine, onPhaseChange) {
  let teamVotesMap = {}; // { playerId: true/false }
  let questSecretVotes = []; // boolean[]
  let isTeamVotingComplete = false;
  let isQuestVoteRevealed = false;
  let lastVoteResult = null;
  let lastQuestResult = null;
  
  // 비밀 원정 투표 진행 중인 원정대원 인덱스
  let currentQuestVoteMemberIndex = 0;
  let isCurrentQuestMemberRevealed = false;

  function updateDOM() {
    const qConfig = engine.getCurrentQuestConfig();
    const leader = engine.getCurrentLeader();

    container.innerHTML = `
      <div class="view-card quest-card animate-fade-in">
        <!-- 1. Scoreboard & Round Track -->
        <div class="scoreboard-bar">
          <div class="score-box good-score">
            <span class="score-label">정의 (Good)</span>
            <span class="score-val">${engine.goodScore} / 3</span>
          </div>

          <div class="rounds-tracker">
            ${Array.from({ length: 5 }).map((_, i) => {
              const roundNum = i + 1;
              const roundConfig = QUEST_CONFIG[engine.players.length][i];
              const result = engine.questResults.find(r => r.round === roundNum);
              let statusClass = 'pending';
              let icon = `${roundConfig.count}명`;

              if (result) {
                statusClass = result.success ? 'good-win' : 'evil-win';
                icon = result.success ? '🔵' : '🔴';
              } else if (roundNum === engine.currentRound) {
                statusClass = 'active';
              }

              return `
                <div class="round-badge ${statusClass}">
                  <span class="round-num">${roundNum}R</span>
                  <span class="round-icon">${icon}</span>
                  ${roundConfig.failsNeeded > 1 ? '<span class="fails-tag">2패</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div class="score-box evil-score">
            <span class="score-label">악 (Evil)</span>
            <span class="score-val">${engine.evilScore} / 3</span>
          </div>
        </div>

        <!-- 2. Leader & Rejection Tracker -->
        <div class="leader-info-strip">
          <div class="leader-badge">
            <span class="crown-icon">👑</span>
            <span>이번 원정대장: <strong>${leader.name}</strong></span>
          </div>
          <div class="rejection-tracker ${engine.rejectionCount >= 3 ? 'warn' : ''}">
            <span>부결 횟수: <strong>${engine.rejectionCount} / 5</strong></span>
            ${engine.rejectionCount >= 4 ? '<span class="danger-pill">🚨 1회 추가 부결 시 악 승리!</span>' : ''}
          </div>
        </div>

        <!-- Dynamic Phase Sub-Views -->
        ${renderSubPhaseContent(qConfig, leader)}
      </div>
    `;

    bindEvents();
  }

  function renderSubPhaseContent(qConfig, leader) {
    if (engine.phase === GAME_PHASE.QUEST_BUILDING) {
      const isSelectedCountValid = engine.selectedTeamIds.length === qConfig.count;

      return `
        <div class="subphase-box">
          <div class="subphase-header">
            <h3>🗡️ [${engine.currentRound}라운드] 원정대원 지목</h3>
            <p class="subphase-desc">
              원정대장 <strong>${leader.name}</strong> 님은 원정대원 <strong>${qConfig.count}명</strong>을 선택하세요.
              ${qConfig.failsNeeded > 1 ? '<span class="highlight-text">(4라운드 룰: 실패 카드 2장 이상 발생 시 원정 실패)</span>' : ''}
            </p>
          </div>

          <div class="players-selection-grid">
            ${engine.players.map(player => {
              const isSelected = engine.selectedTeamIds.includes(player.id);
              const isLeader = player.isLeader;

              return `
                <button type="button" class="player-select-btn ${isSelected ? 'selected' : ''} ${isLeader ? 'is-leader' : ''}" data-player-id="${player.id}">
                  <span class="player-avatar">${player.name.charAt(0)}</span>
                  <span class="player-name">${player.name}</span>
                  ${isLeader ? '<span class="leader-crown">👑</span>' : ''}
                  ${isSelected ? '<span class="check-mark">✓</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>

          <div class="phase-actions">
            <button type="button" id="btn-submit-team" class="btn-primary btn-large ${!isSelectedCountValid ? 'disabled' : ''}" ${!isSelectedCountValid ? 'disabled' : ''}>
              원정대 선출 확정 (${engine.selectedTeamIds.length} / ${qConfig.count}명)
            </button>
          </div>
        </div>
      `;
    }

    if (engine.phase === GAME_PHASE.TEAM_VOTE) {
      const selectedPlayerNames = engine.selectedTeamIds.map(id => engine.players.find(p => p.id === id).name).join(', ');
      const totalPlayers = engine.players.length;
      const votesCount = Object.keys(teamVotesMap).length;

      return `
        <div class="subphase-box">
          <div class="subphase-header">
            <h3>🗳️ 원정대 찬반 투표</h3>
            <p class="subphase-desc">
              선출된 원정대: <strong class="selected-team-names">[ ${selectedPlayerNames} ]</strong>
            </p>
          </div>

          ${!lastVoteResult ? `
            <div class="voting-grid">
              ${engine.players.map(player => {
                const hasVoted = teamVotesMap[player.id] !== undefined;
                return `
                  <div class="vote-player-row">
                    <span class="voter-name">${player.name}</span>
                    <div class="vote-btn-group">
                      <button type="button" class="btn-vote approve ${teamVotesMap[player.id] === true ? 'active' : ''}" data-voter-id="${player.id}" data-vote="true">
                        👍 찬성
                      </button>
                      <button type="button" class="btn-vote reject ${teamVotesMap[player.id] === false ? 'active' : ''}" data-voter-id="${player.id}" data-vote="false">
                        👎 반대
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="phase-actions">
              <button type="button" id="btn-tally-team-vote" class="btn-primary btn-large ${votesCount < totalPlayers ? 'disabled' : ''}" ${votesCount < totalPlayers ? 'disabled' : ''}>
                📊 투표 개표하기 (${votesCount} / ${totalPlayers}명 완료)
              </button>
            </div>
          ` : `
            <!-- 개표 결과 발표 -->
            <div class="vote-result-box ${lastVoteResult.passed ? 'result-passed' : 'result-rejected'} animate-bounce-in">
              <div class="result-icon">${lastVoteResult.passed ? '🎉' : '❌'}</div>
              <h3>${lastVoteResult.passed ? '원정대 승인 (통과)' : '원정대 부결'}</h3>
              <p class="result-breakdown">찬성: ${lastVoteResult.approveCount}표 / 반대: ${lastVoteResult.rejectCount}표</p>
              
              <!-- 각 개별 플레이어 표 전체 공개 -->
              <div class="detailed-votes-list">
                <h4>플레이어별 투표 내역:</h4>
                <div class="votes-tags">
                  ${Object.entries(teamVotesMap).map(([pId, isApprove]) => {
                    const p = engine.players.find(x => x.id === pId);
                    return `
                      <span class="vote-tag ${isApprove ? 'tag-approve' : 'tag-reject'}">
                        ${p.name}: ${isApprove ? '👍 찬성' : '👎 반대'}
                      </span>
                    `;
                  }).join('')}
                </div>
              </div>

              <div class="phase-actions">
                <button type="button" id="btn-continue-after-vote" class="btn-primary btn-large">
                  ${lastVoteResult.passed ? '⚔️ 원정 비밀 투표 진행' : '🔄 다음 리더에게 원정대장 넘기기'}
                </button>
              </div>
            </div>
          `}
        </div>
      `;
    }

    if (engine.phase === GAME_PHASE.QUEST_VOTE) {
      const selectedTeam = engine.selectedTeamIds.map(id => engine.players.find(p => p.id === id));
      const currentMember = selectedTeam[currentQuestVoteMemberIndex];

      return `
        <div class="subphase-box">
          <div class="subphase-header">
            <h3>🗡️ 비밀 원정 성패 투표</h3>
            <p class="subphase-desc">원정대원은 카드를 아무도 안 보게 무작위 카드 비밀 제출하세요.</p>
          </div>

          ${!lastQuestResult ? `
            ${currentMember ? `
              <div class="pass-player-box quest-pass-box">
                <span class="member-step">대원 ${currentQuestVoteMemberIndex + 1} / ${selectedTeam.length}</span>
                <h3 class="current-player-name">${currentMember.name} 님 차례</h3>
                
                ${!isCurrentQuestMemberRevealed ? `
                  <p class="curtain-notice">⚠️ 본인만 화면을 확인하고 아래 버튼을 눌러 카드를 제출하세요.</p>
                  <button type="button" id="btn-reveal-quest-input" class="btn-primary btn-large">
                    🔒 비밀 투표 카드 선택하기
                  </button>
                ` : `
                  <div class="quest-card-options animate-flip-in">
                    <p class="role-reminder">
                      당신의 역할: <strong>${currentMember.role.name} (${currentMember.role.team === TEAM.GOOD ? '정의' : '악'})</strong>
                      ${currentMember.role.team === TEAM.GOOD ? '<br/><span class="good-text">※ 정의의 세력은 반드시 성공 카드만 선택 가능합니다.</span>' : ''}
                    </p>

                    <div class="quest-btns-flex">
                      <button type="button" class="btn-quest-card btn-quest-success" data-quest-vote="true">
                        🔵 원정 성공 (Success)
                      </button>

                      ${currentMember.role.team === TEAM.EVIL ? `
                        <button type="button" class="btn-quest-card btn-quest-fail" data-quest-vote="false">
                          🔴 원정 실패 (Fail)
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `}
              </div>
            ` : `
              <!-- 모든 대원 제출 완료 -> 셔플 및 개표 -->
              <div class="tally-ready-box">
                <h3>🎴 모든 원정대원이 비밀 투표를 완료했습니다!</h3>
                <p>제출된 카드를 잘 섞어서 결과를 개표합니다.</p>
                <button type="button" id="btn-tally-quest" class="btn-success btn-large glow-btn">
                  ✨ 비밀 카드 섞기 & 원정 개표!
                </button>
              </div>
            `}
          ` : `
            <!-- 원정 개표 결과 발표 -->
            <div class="quest-result-display ${lastQuestResult.isSuccess ? 'quest-passed' : 'quest-failed'} animate-bounce-in">
              <div class="result-icon-lg">${lastQuestResult.isSuccess ? '🔵' : '🔴'}</div>
              <h2>${lastQuestResult.isSuccess ? '원정 성공 (SUCCESS)!' : '원정 실패 (FAIL)!'}</h2>
              
              <div class="cards-revealed-flex">
                <span class="card-count-badge good-bg">성공 카드: ${lastQuestResult.successCards}장</span>
                <span class="card-count-badge evil-bg">실패 카드: ${lastQuestResult.failCards}장</span>
              </div>
              
              ${qConfig.failsNeeded > 1 ? `
                <p class="rule-note-sm">※ 4라운드 규칙: 실패 카드 2장 이상 필요 (${lastQuestResult.failCards}장 제출됨)</p>
              ` : ''}

              <div class="phase-actions">
                <button type="button" id="btn-continue-quest-result" class="btn-primary btn-large">
                  다음 단계 진행하기 ➔
                </button>
              </div>
            </div>
          `}
        </div>
      `;
    }

    return '';
  }

  function bindEvents() {
    // 1. QUEST_BUILDING - 원정대원 선택
    container.querySelectorAll('.player-select-btn').forEach(btn => {
      btn.onclick = (e) => {
        const pid = e.currentTarget.dataset.playerId;
        engine.toggleTeamMember(pid);
        updateDOM();
      };
    });

    const submitTeamBtn = container.querySelector('#btn-submit-team');
    if (submitTeamBtn) {
      submitTeamBtn.onclick = () => {
        engine.submitTeamSelection();
        teamVotesMap = {};
        lastVoteResult = null;
        updateDOM();
      };
    }

    // 2. TEAM_VOTE - 찬반 투표 버튼
    container.querySelectorAll('.btn-vote').forEach(btn => {
      btn.onclick = (e) => {
        const voterId = e.currentTarget.dataset.voterId;
        const isApprove = e.currentTarget.dataset.vote === 'true';
        teamVotesMap[voterId] = isApprove;
        updateDOM();
      };
    });

    const tallyVoteBtn = container.querySelector('#btn-tally-team-vote');
    if (tallyVoteBtn) {
      tallyVoteBtn.onclick = () => {
        lastVoteResult = engine.submitTeamVote(teamVotesMap);
        updateDOM();
      };
    }

    const continueAfterVoteBtn = container.querySelector('#btn-continue-after-vote');
    if (continueAfterVoteBtn) {
      continueAfterVoteBtn.onclick = () => {
        if (lastVoteResult.gameOver) {
          onPhaseChange();
        } else if (lastVoteResult.passed) {
          // 원정 성패 카드 제출 초기화
          questSecretVotes = [];
          currentQuestVoteMemberIndex = 0;
          isCurrentQuestMemberRevealed = false;
          lastQuestResult = null;
          updateDOM();
        } else {
          // 부결되어 다음 리더
          teamVotesMap = {};
          lastVoteResult = null;
          updateDOM();
        }
      };
    }

    // 3. QUEST_VOTE - 성패 투표
    const revealQuestInputBtn = container.querySelector('#btn-reveal-quest-input');
    if (revealQuestInputBtn) {
      revealQuestInputBtn.onclick = () => {
        isCurrentQuestMemberRevealed = true;
        updateDOM();
      };
    }

    container.querySelectorAll('.btn-quest-card').forEach(btn => {
      btn.onclick = (e) => {
        const isSuccess = e.currentTarget.dataset.questVote === 'true';
        questSecretVotes.push(isSuccess);
        
        currentQuestVoteMemberIndex++;
        isCurrentQuestMemberRevealed = false;
        updateDOM();
      };
    });

    const tallyQuestBtn = container.querySelector('#btn-tally-quest');
    if (tallyQuestBtn) {
      tallyQuestBtn.onclick = () => {
        // 비밀 셔플 처리
        const shuffledVotes = engine.shuffle(questSecretVotes);
        lastQuestResult = engine.submitQuestVote(shuffledVotes);
        updateDOM();
      };
    }

    const continueQuestResultBtn = container.querySelector('#btn-continue-quest-result');
    if (continueQuestResultBtn) {
      continueQuestResultBtn.onclick = () => {
        onPhaseChange();
      };
    }
  }

  updateDOM();
}
