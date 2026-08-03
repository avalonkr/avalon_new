import { getRoleTag } from './gameLogic.js';
import { ROLES } from './constants.js';

export function generateMarkdownHistory(roomId, playersData, playData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR') + ' ' + now.toLocaleTimeString('ko-KR');

  let md = `# 아발론 게임 기록\n`;
  md += `**일시:** ${dateStr}\n`;
  md += `**방 코드:** ${roomId}\n`;
  md += `**참여 인원:** ${Object.keys(playersData).length}명\n\n`;

  md += `## 👥 참가자 명단 및 최종 직업\n`;
  const pList = playData.playerOrder.map((id, idx) => {
    const p = playersData[id];
    return `${idx + 1}. **${p.nickname}** - ${p.role}`;
  });
  md += pList.join('\n') + `\n\n`;

  md += `## 📜 라운드별 상세 진행 타임라인\n`;
  
  let roundNum = 1;
  let currentRoundString = "";

  (playData.timeline || []).forEach(evt => {
    if (evt.type === 'quest_start') {
      roundNum = evt.round;
      currentRoundString = `### 🗡️ 제 ${roundNum} 원정\n`;
      md += currentRoundString;
    } 
    else if (evt.type === 'team_proposed') {
      const leaderName = playersData[evt.leaderId]?.nickname || "알 수 없음";
      const teamNames = (evt.team || []).map(id => playersData[id]?.nickname + getRoleTag(playersData[id]?.role)).join(', ');
      md += `* 👑 **원정대장 [${leaderName}${getRoleTag(playersData[evt.leaderId]?.role)}]** 님의 ${evt.attempt}번째 제안\n`;
      md += `  * 지목된 대원: [ ${teamNames} ]\n`;
    }
    else if (evt.type === 'team_voted') {
      const isPassed = evt.passed ? "🟢 **[승인]**" : "🔴 **[부결]**";
      md += `  * 원정대 찬반 투표 결과: ${isPassed} (찬성 ${evt.approve} / 반대 ${evt.reject})\n`;
      let voteDetails = [];
      Object.entries(evt.votes).forEach(([voterId, vote]) => {
        const vName = playersData[voterId]?.nickname + getRoleTag(playersData[voterId]?.role);
        const vRes = vote === 'approve' ? '👍찬성' : '👎반대';
        voteDetails.push(`${vName}: ${vRes}`);
      });
      md += `    * 세부 투표: ${voteDetails.join(', ')}\n`;
    }
    else if (evt.type === 'quest_result') {
      const qRes = evt.result === 'success' ? "🔵 **[원정 성공]**" : "🔴 **[원정 실패]**";
      md += `  * ⚔️ **원정 결과:** ${qRes} (성공 ${evt.successCount} / 실패 ${evt.failCount})\n\n`;
    }
    else if (evt.type === 'assassination') {
      md += `### 🗡️ 암살자 단계\n`;
      const assassinName = playersData[evt.assassinId]?.nickname;
      const targetName = playersData[evt.targetId]?.nickname;
      const targetRole = playersData[evt.targetId]?.role;
      const isSuccess = evt.success ? "🟢 **[암살 성공]**" : "🔴 **[암살 실패]**";
      
      md += `* 어쌔신 **${assassinName}** 님이 **${targetName}**(을)를 멀린으로 지목했습니다.\n`;
      md += `* 결과: ${isSuccess} (${targetName}의 실제 직업은 ${targetRole})\n\n`;
    }
  });

  md += `## 🏆 최종 결과\n`;
  if (playData.voteTrack >= 5) {
    md += `**[악 진영 승리]** 원정대 투표 5연속 부결\n`;
  } else if ((playData.questResults || []).filter(r => r === 'fail').length >= 3) {
    md += `**[악 진영 승리]** 원정 3회 실패\n`;
  } else if (playData.assassinatedTarget) {
    const targetRole = playersData[playData.assassinatedTarget]?.role;
    if (targetRole === ROLES.MERLIN) md += `**[악 진영 승리]** 멀린 암살 성공\n`;
    else md += `**[선 진영 승리]** 원정 3회 성공 및 멀린 보존\n`;
  } else {
    md += `**[알 수 없음]** 게임이 비정상 종료되었습니다.\n`;
  }

  return md;
}
