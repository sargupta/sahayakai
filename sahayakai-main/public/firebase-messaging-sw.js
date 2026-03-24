/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw",
    authDomain: "sahayakai-b4248.firebaseapp.com",
    projectId: "sahayakai-b4248",
    storageBucket: "sahayakai-b4248.firebasestorage.app",
    messagingSenderId: "640589855975",
    appId: "1:640589855975:web:624436f873a78069aa3642",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    self.registration.showNotification(title || 'New Message', {
        body: body || 'You have a new message',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: { url: data.link || '/messages' },
        tag: data.conversationId || 'message',  // prevents duplicate notifications
        renotify: true,
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/messages';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});
