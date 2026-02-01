// Leaderboard module - extracted from leaderboard.html

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
  if (typeof text !== 'string') return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, char => map[char]);
}

const elements = {
  searchBtn: document.getElementById('searchBtn'),
  fingerprintSearch: document.getElementById('fingerprintSearch'),
  searchResults: document.getElementById('searchResults'),
  searchDialog: document.getElementById('searchDialog'),
  searchCloseBtn: document.getElementById('searchCloseBtn'),
  topPerformers: document.getElementById('topPerformers'),
  recentLogins: document.getElementById('recentLogins'),
};

let timezone = 'America/Edmonton';

function getLevelColor(level) {
  const ratio = level / 15;
  const green = { r: 39, g: 201, b: 63 };
  const gold = { r: 255, g: 215, b: 0 };
  const r = Math.round(green.r + (gold.r - green.r) * ratio);
  const g = Math.round(green.g + (gold.g - green.g) * ratio);
  const b = Math.round(green.b + (gold.b - green.b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const tzAbbr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
    .formatToParts(date)
    .find(part => part.type === 'timeZoneName')?.value || '';
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replace(/,/g, '');
  return `${formatted} ${tzAbbr}`;
}

function formatTimestampNoTZ(timestamp) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replace(/,/g, '');
}

function positionCloseBtn() {
  const content = document.querySelector('.search-dialog-content');
  if (content) {
    const rect = content.getBoundingClientRect();
    elements.searchCloseBtn.style.top = (rect.top + 10) + 'px';
    elements.searchCloseBtn.style.left = (rect.right - 40) + 'px';
  }
}

function renderTopPerformers(performers) {
  if (performers.length === 0) {
    elements.topPerformers.innerHTML = '<div class="empty-state">No data yet</div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  elements.topPerformers.innerHTML = performers.map((p, i) => {
    const color = getLevelColor(p.level);
    const glow = p.level === 15 ? `text-shadow: 0 0 10px ${color};` : '';
    const displayName = escapeHtml(p.preferred_name || p.fingerprint.substring(0, 12));
    const fingerprintShort = escapeHtml(p.fingerprint.substring(0, 12));
    const hasPreferredName = !!p.preferred_name;

    return `
    <div class="leaderboard-item">
      <div>
        <span class="medal">${medals[i] || ''}</span>
        <span class="level" style="cursor: pointer; color: ${color}; ${glow}" onclick="searchByFingerprint('${fingerprintShort}')" ${hasPreferredName ? `data-fingerprint="${fingerprintShort}" data-preferred="${displayName}"` : ''}>${p.level} - <span class="name-display">${displayName}</span></span>
      </div>
      <div class="meta">Last seen: ${formatTime(p.last_seen)}</div>
    </div>
  `;
  }).join('');
  
  // Add hover listeners for preferred names
  document.querySelectorAll('.level[data-fingerprint]').forEach(el => {
    const nameSpan = el.querySelector('.name-display');
    const fingerprint = el.dataset.fingerprint;
    const preferred = el.dataset.preferred;
    
    el.addEventListener('mouseenter', () => {
      nameSpan.textContent = fingerprint;
    });
    
    el.addEventListener('mouseleave', () => {
      nameSpan.textContent = preferred;
    });
  });
}

function renderRecentLogins(logins) {
  if (logins.length === 0) {
    elements.recentLogins.innerHTML = '<div class="empty-state">No logins yet</div>';
    return;
  }

  elements.recentLogins.innerHTML = logins.map(login => {
    const match = login.username?.match(/^overlord(\d+)$/);
    let usernameStyle = '';
    if (match) {
      const level = parseInt(match[1]);
      const color = getLevelColor(level);
      const glow = level === 15 ? `text-shadow: 0 0 10px ${color};` : '';
      usernameStyle = `style="color: ${color}; ${glow}"`;
    }
    return `
    <div class="login-item">
      <span class="username" ${usernameStyle}>${login.username}</span>
      <span class="fingerprint" onclick="searchByFingerprint('${login.fingerprint.substring(0, 12)}')">${login.fingerprint.substring(0, 12)}</span>
      <span class="timestamp">${formatTime(login.timestamp)}</span>
    </div>
  `;
  }).join('');
}

async function loadDashboard() {
  try {
    const res = await fetch('/leaderboard/dashboard');
    const data = await res.json();
    timezone = data.timezone || 'America/Edmonton';
    renderTopPerformers(data.topPerformers);
    renderRecentLogins(data.recentLogins);
  } catch (err) {
    elements.topPerformers.innerHTML = '<div class="error">Error loading dashboard</div>';
    elements.recentLogins.innerHTML = '<div class="error">Error loading dashboard</div>';
  }
}

async function searchLogs() {
  const fingerprint = elements.fingerprintSearch.value.trim();
  if (!fingerprint) {
    elements.searchResults.innerHTML = '<div class="no-results">Please enter a fingerprint</div>';
    elements.searchDialog.classList.remove('hidden');
    setTimeout(positionCloseBtn, 10);
    return;
  }

  elements.searchResults.innerHTML = '<div class="loading">Loading...</div>';
  elements.searchDialog.classList.remove('hidden');
  setTimeout(positionCloseBtn, 10);

  try {
    const res = await fetch(`/leaderboard/logs?fingerprint=${encodeURIComponent(fingerprint)}`);
    const data = await res.json();

    if (data.logs && data.logs.length > 0) {
      const tzAbbr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find(part => part.type === 'timeZoneName')?.value || '';
      elements.searchResults.innerHTML = `
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Timestamp ${tzAbbr}</th>
              <th>Event</th>
              <th>Username</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${data.logs.map(log => {
              let eventColor = '#d4d4d4';
              if (log.event_type === 'auth_success') eventColor = '#27c93f';
              else if (log.event_type === 'auth_failure') eventColor = '#ff4444';
              else if (log.event_type === 'connection_error') eventColor = '#ffcc00';
              
              let usernameColor = '#d4d4d4';
              let usernameStyle = '';
              if (log.event_type === 'auth_success') {
                const match = log.username?.match(/^overlord(\d+)$/);
                if (match) {
                  const level = parseInt(match[1]);
                  usernameColor = getLevelColor(level);
                  if (level === 15) {
                    usernameStyle = `color: ${usernameColor}; text-shadow: 0 0 10px ${usernameColor};`;
                  } else {
                    usernameStyle = `color: ${usernameColor}`;
                  }
                } else {
                  usernameStyle = `color: ${usernameColor}`;
                }
              } else {
                usernameStyle = `color: ${usernameColor}`;
              }
              
              return `
              <tr>
                <td>${formatTimestampNoTZ(log.timestamp)}</td>
                <td style="color: ${eventColor}">${log.event_type}</td>
                <td style="${usernameStyle}">${log.username || '-'}</td>
                <td>${log.details || '-'}</td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      elements.searchResults.innerHTML = '<div class="no-results">No logs found for this fingerprint</div>';
    }
    setTimeout(positionCloseBtn, 10);
  } catch (err) {
    elements.searchResults.innerHTML = '<div class="error">Error loading logs</div>';
    setTimeout(positionCloseBtn, 10);
  }
}

// Global function for onclick handlers
window.searchByFingerprint = function(fp) {
  elements.fingerprintSearch.value = fp;
  searchLogs();
  elements.fingerprintSearch.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

export function initLeaderboard() {
  loadDashboard();

  elements.searchBtn.addEventListener('click', searchLogs);
  elements.fingerprintSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchLogs();
  });

  elements.searchCloseBtn.addEventListener('click', () => {
    elements.searchDialog.classList.add('hidden');
  });

  elements.searchDialog.addEventListener('click', (e) => {
    if (e.target === elements.searchDialog) {
      elements.searchDialog.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.searchDialog.classList.contains('hidden')) {
      elements.searchDialog.classList.add('hidden');
    }
  });

  const observer = new MutationObserver(() => {
    if (!elements.searchDialog.classList.contains('hidden')) {
      setTimeout(positionCloseBtn, 0);
    }
  });
  observer.observe(elements.searchDialog, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', positionCloseBtn);
}
