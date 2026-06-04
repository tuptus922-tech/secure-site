(async () => {
  if (document.cookie.includes('device_token')) return;
  const token = localStorage.getItem('auth_token');
  if (!token) return;
  try {
    const res = await fetch('/api/autologin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (res.ok) {
      window.location.reload();
    } else {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
  } catch(e) {}
})();