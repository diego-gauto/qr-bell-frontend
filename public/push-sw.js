self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'QR Bell',
    body: 'Hay alguien en la puerta',
    data: {}
  };

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    payload = {
      title: 'QR Bell',
      body: 'Hay alguien en la puerta',
      data: {}
    };
  }

  const options = {
    body: payload.body ?? 'Hay alguien en la puerta',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: true,
    tag: 'qr-bell-ring',
    data: payload.data ?? {}
  };

  event.waitUntil(self.registration.showNotification(payload.title ?? 'QR Bell', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const ringUrl = event.notification?.data?.ringUrl;
  const targetUrl = typeof ringUrl === 'string' && ringUrl.length > 0 ? ringUrl : '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
