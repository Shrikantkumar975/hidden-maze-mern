const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function loadProgress(playerId) {
  const response = await fetch(`${API}/progress/${encodeURIComponent(playerId)}`);
  if (!response.ok) throw new Error('Progress request failed');
  return response.json();
}

export async function saveCompletion(playerId, levelIndex, moves, timeRemaining) {
  const response = await fetch(`${API}/progress/${encodeURIComponent(playerId)}/complete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ levelIndex, moves, timeRemaining })
  });
  if (!response.ok) throw new Error('Progress save failed');
  return response.json();
}

export async function resetProgress(playerId) {
  const response = await fetch(`${API}/progress/${encodeURIComponent(playerId)}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Progress reset failed');
  return response.json();
}
