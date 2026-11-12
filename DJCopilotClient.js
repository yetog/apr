// Optional APR UI bridge to the local DJ Copilot API. No playback changes.
const ENDPOINT = 'http://127.0.0.1:8765';

export async function mountDJCopilotPanel() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || document.getElementById('dj-copilot-panel')) return;

  const panel = document.createElement('section');
  panel.id = 'dj-copilot-panel';
  panel.style.cssText = 'margin:12px;padding:12px;border:1px solid #8768ae;border-radius:10px;color:white;background:#181125;max-height:240px;overflow:auto';
  const title = document.createElement('strong');
  title.textContent = 'DJ Copilot (local)';
  const status = document.createElement('p');
  status.style.cssText = 'font-size:12px;opacity:.85';
  const tracks = document.createElement('ul');
  tracks.style.cssText = 'font-size:12px;padding-left:18px';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh library';
  refresh.style.cssText = 'padding:5px 9px;margin-bottom:8px;color:#fff;background:#60418a;border:0;border-radius:5px;cursor:pointer';

  async function request(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(ENDPOINT + path, {signal: controller.signal});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function refreshStatus() {
    refresh.disabled = true;
    tracks.replaceChildren();
    try {
      const health = await request('/api/health');
      status.textContent = 'Connected • ' + health.track_count + ' indexed tracks • read-only';
      const result = await request('/api/tracks?limit=8');
      for (const track of result.tracks || []) {
        const item = document.createElement('li');
        item.textContent = [track.artist, track.title].filter(Boolean).join(' — ');
        tracks.appendChild(item);
      }
    } catch (_) {
      status.textContent = 'Local service offline. Start apr-dj api to connect.';
    } finally {
      refresh.disabled = false;
    }
  }
  refresh.addEventListener('click', refreshStatus);
  panel.append(title, status, refresh, tracks);
  sidebar.appendChild(panel);
  await refreshStatus();
}
