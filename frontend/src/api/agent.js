const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export async function executeAgent(request) {
  const response = await fetch(`${API_URL}/api/agent/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export async function getActiveAgents() {
  const response = await fetch(`${API_URL}/api/agent/active`);
  return response.json();
}
