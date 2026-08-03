export function renderHistoryView(container, historyData, callbacks) {
  container.innerHTML = `
    <div class="history-layout animate-fade-in">
      <div class="history-list-panel">
        <h3>📜 저장된 게임 목록</h3>
        <div id="historyListContainer" class="history-scroll-area">
          ${historyData ? Object.entries(historyData).reverse().map(([id, game]) => {
            const dateStr = game.date || (game.timestamp ? new Date(game.timestamp).toLocaleString('ko-KR') : '날짜 없음');
            return `
            <div class="history-item" data-id="${id}">
              <div class="history-title">${dateStr} - 방 ${game.roomId}</div>
              <button class="delete-btn" data-id="${id}">🗑️</button>
            </div>
            `;
          }).join('') : '<p class="empty-text">저장된 기록이 없습니다.</p>'}
        </div>
        <button id="closeHistoryBtn" class="btn-secondary btn-sm" style="margin-top: 15px; width: 100%;">로비로 돌아가기</button>
      </div>
      
      <div class="history-viewer-panel">
        <div class="viewer-header">
          <h3 id="historyDetailTitle" style="margin: 0; color: var(--gold-primary);">기록을 선택하세요</h3>
          <div class="viewer-actions">
            <button id="copyHistoryBtn" class="btn-primary btn-sm">📋 복사</button>
            <button id="toggleHtmlBtn" class="btn-success btn-sm is-ready">뷰</button>
            <button id="toggleMdBtn" class="btn-outline btn-sm">원문</button>
          </div>
        </div>
        
        <div id="historyHtmlContent" class="md-content">좌측 목록에서 게임을 선택하면 게임 기록 데이터가 표시됩니다.</div>
        <textarea id="historyMdContent" class="md-textarea hidden" readonly></textarea>
      </div>
    </div>
  `;

  let activeMarkdown = "";
  
  const htmlContent = document.getElementById('historyHtmlContent');
  const mdContent = document.getElementById('historyMdContent');
  const btnHtml = document.getElementById('toggleHtmlBtn');
  const btnMd = document.getElementById('toggleMdBtn');

  // 아이템 클릭 이벤트
  container.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return; // 삭제 버튼 클릭시 무시
      
      container.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      
      const gameId = item.dataset.id;
      const game = historyData[gameId];
      activeMarkdown = game.markdown || "기록 내용이 없습니다.";
      
      document.getElementById('historyDetailTitle').innerText = `${game.roomId}방 결과`;
      
      if (window.marked) {
        htmlContent.innerHTML = window.marked.parse(activeMarkdown);
      } else {
        htmlContent.innerHTML = "<p>Markdown 파서를 불러오지 못했습니다.</p>";
      }
      mdContent.value = activeMarkdown;
    });
  });

  // 삭제 이벤트
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if(confirm('이 기록을 삭제하시겠습니까?')) {
        callbacks.onDelete(e.target.dataset.id);
      }
    });
  });

  // 뷰 토글
  btnHtml.onclick = () => {
    btnHtml.classList.replace('btn-outline', 'btn-success');
    btnMd.classList.replace('btn-success', 'btn-outline');
    htmlContent.classList.remove('hidden');
    mdContent.classList.add('hidden');
  };

  btnMd.onclick = () => {
    btnMd.classList.replace('btn-outline', 'btn-success');
    btnHtml.classList.replace('btn-success', 'btn-outline');
    mdContent.classList.remove('hidden');
    htmlContent.classList.add('hidden');
  };

  // 복사
  document.getElementById('copyHistoryBtn').onclick = () => {
    if (!activeMarkdown) return alert("복사할 내용이 없습니다.");
    navigator.clipboard.writeText(activeMarkdown).then(() => {
      alert("클립보드에 복사되었습니다!");
    });
  };

  document.getElementById('closeHistoryBtn').onclick = () => callbacks.onClose();
}
