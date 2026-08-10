import { getRoleTag } from './gameLogic.js';
import { ROLES } from './constants.js';

export function generateMarkdownHistory(roomId, playersData, playData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR') + ' ' + now.toLocaleTimeString('ko-KR');

  let md = `📝 아발론 게임 기록 (${dateStr})\n`;
  md += `🎭 참가자 직업 명단\n`;
  
  const pList = playData.playerOrder.map(id => {
    const p = playersData[id];
    return `${p.nickname} : ${p.role}`;
  });
  md += pList.join('\n') + `\n\n`;

  let roundNum = 1;

  (playData.timeline || []).forEach(evt => {
    if (evt.type === 'quest_start') {
      roundNum = evt.round;
    } 
    else if (evt.type === 'team_proposed') {
      const leaderName = playersData[evt.leaderId]?.nickname || "알 수 없음";
      const leaderTag = getRoleTag(playersData[evt.leaderId]?.role);
      const teamNames = (evt.team || []).map(id => playersData[id]?.nickname + " " + getRoleTag(playersData[id]?.role)).join(', ');
      
      md += `🚩 ${roundNum}라운드 - ${evt.attempt}차 제안\n`;
      md += `👑 원정대장: ${leaderName} ${leaderTag}\n`;
      md += `👥 원정대원: ${teamNames}\n`;
    }
    else if (evt.type === 'team_voted') {
      const isPassed = evt.passed ? "가결 🟢" : "부결 🔴";
      md += `🗳️ 찬반 투표 결과: ${isPassed}\n`;
      
      const approveList = [];
      const rejectList = [];
      Object.entries(evt.votes).forEach(([voterId, vote]) => {
        const vName = playersData[voterId]?.nickname + " " + getRoleTag(playersData[voterId]?.role);
        if (vote === 'approve') approveList.push(vName);
        else rejectList.push(vName);
      });
      
      md += `찬성: ${approveList.length > 0 ? approveList.join(', ') : '없음'}\n`;
      md += `반대: ${rejectList.length > 0 ? rejectList.join(', ') : '없음'}\n`;
    }
    else if (evt.type === 'quest_result') {
      const qRes = evt.result === 'success' ? "성공 🟢" : "실패 🔴";
      md += `⚔️ 임무 수행 결과: ${qRes}\n`;
      
      const successSubmitters = [];
      const failSubmitters = [];
      
      if (evt.questVotes) {
        Object.entries(evt.questVotes).forEach(([vId, v]) => {
          const vName = playersData[vId]?.nickname + " " + getRoleTag(playersData[vId]?.role);
          if (v === 'success') successSubmitters.push(vName);
          else failSubmitters.push(vName);
        });
      }
      
      if (successSubmitters.length > 0 || failSubmitters.length > 0) {
        md += `성공 제출: ${successSubmitters.length > 0 ? successSubmitters.join(', ') : '없음'}\n`;
        md += `실패 제출: ${failSubmitters.length > 0 ? failSubmitters.join(', ') : '없음'}\n\n`;
      } else {
        md += `제출된 결과: (성공 ${evt.successCount} / 실패 ${evt.failCount})\n\n`;
      }
    }
    else if (evt.type === 'assassination') {
      const assassinName = playersData[evt.assassinId]?.nickname;
      const targetName = playersData[evt.targetId]?.nickname;
      const targetRole = playersData[evt.targetId]?.role;
      const isSuccess = evt.success ? "성공" : "실패";
      
      md += `🗡️ 암살자 지목\n`;
      md += `암살자(${assassinName})가 멀린으로 지목한 대상: ${targetName} (${targetRole})\n`;
      md += `암살 결과: ${isSuccess}\n\n`;
    }
  });

  md += `🏆 최종 결과\n`;
  if (playData.voteTrack >= 5) {
    md += `악 진영 최종 승리! (원정대 투표 5연속 부결)\n`;
  } else if ((playData.questResults || []).filter(r => r === 'fail').length >= 3) {
    md += `악 진영 최종 승리! (임무 3회 실패)\n`;
  } else if (playData.assassinatedTarget) {
    const targetRole = playersData[playData.assassinatedTarget]?.role;
    if (targetRole === ROLES.MERLIN) {
      md += `암살자 성공: 악 진영 최종 승리!\n`;
    } else {
      const targetName = playersData[playData.assassinatedTarget]?.nickname;
      md += `암살자 실패(${targetName}): 선 진영 최종 승리!\n`;
    }
  } else {
    md += `알 수 없음 (게임 비정상 종료)\n`;
  }

  return md;
}
