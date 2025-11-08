// Service Worker for background notifications
// Works in both development (localhost) and production (HTTPS)
// This allows notifications to work even when the app tab is closed

const CACHE_NAME = 'adullam-prayer-v1'
const NOTIFICATION_ICON = '/vite.svg'

// Install event - cache resources and activate immediately
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...')
  // Skip waiting to activate immediately (important for notifications)
  self.skipWaiting()
  
  // Cache the service worker itself and basic assets
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/vite.svg',
      ]).catch((error) => {
        console.log('Cache addAll failed (this is okay):', error)
      })
    })
  )
})

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activating...')
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('🗑️ Deleting old cache:', name)
              return caches.delete(name)
            })
        )
      }),
      // Claim all clients immediately (important for notifications)
      self.clients.claim(),
    ])
  )
  console.log('✅ Service Worker activated and ready for notifications!')
})

// Handle push notifications from server (for future server-side push)
self.addEventListener('push', (event) => {
  console.log('📬 Push notification received:', event)
  
  let notificationData = {
    title: 'Prayer Reminder',
    body: 'Time for your daily prayer session!',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: 'prayer-notification',
    requireInteraction: false,
    data: {
      url: '/',
      timestamp: Date.now(),
    },
  }

  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = {
        ...notificationData,
        ...data,
      }
    } catch (e) {
      // If data is not JSON, use as text
      notificationData.body = event.data.text() || notificationData.body
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200], // Vibration pattern for mobile
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: '/vite.svg',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        },
      ],
    })
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification clicked:', event.notification.tag)
  
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        // Check if client URL matches our app
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Focus existing window/tab
          return client.focus().then(() => {
            // Optionally navigate to a specific page
            if (event.notification.data?.url) {
              return client.navigate(event.notification.data.url)
            }
          })
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        const urlToOpen = event.notification.data?.url || '/'
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification closed:', event.notification.tag)
})

// Background sync for checking notifications periodically
// Note: This requires user interaction to register (handled in notificationService.js)
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag)
  
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkNotificationsInBackground())
  }
})

// Periodic background sync (experimental, limited browser support)
// Only works in Chromium-based browsers and requires user gesture
if ('periodicsync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    console.log('⏰ Periodic sync triggered:', event.tag)
    
    if (event.tag === 'check-prayer-notifications') {
      event.waitUntil(checkNotificationsInBackground())
    }
  })
}

// Function to check for notifications in the background
// This can be called from background sync or periodic sync
async function checkNotificationsInBackground() {
  try {
    console.log('🔍 Checking for notifications in background...')
    
    // In a full implementation with a backend, you would:
    // 1. Fetch notification data from your server
    // 2. Check for scheduled notifications
    // 3. Show notifications if conditions are met
    //
    // Example:
    // const response = await fetch('/api/notifications/check', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ userId: '...' }),
    // })
    // const notifications = await response.json()
    //
    // for (const notification of notifications) {
    //   await self.registration.showNotification(notification.title, {
    //     body: notification.body,
    //     icon: NOTIFICATION_ICON,
    //     tag: notification.tag,
    //     data: notification.data,
    //   })
    // }
    
    // For now, client-side checking in the main app handles this
    // Server-side push would trigger the 'push' event above
  } catch (error) {
    console.error('❌ Error checking notifications in background:', error)
  }
}

// Message handler - receive messages from the main app
// This is how we show notifications from the client-side
self.addEventListener('message', (event) => {
  console.log('📨 Service Worker received message:', event.data)
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data } = event.data.payload
    
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon || NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: tag || 'prayer-notification',
        requireInteraction: false,
        data: data || { url: '/', timestamp: Date.now() },
        vibrate: [200, 100, 200], // Vibration pattern for mobile
        actions: [
          {
            action: 'open',
            title: 'Open App',
            icon: '/vite.svg',
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
          },
        ],
      })
    )
    
    // Send confirmation back to client
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true })
    }
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CLIENTS_CLAIM') {
    self.clients.claim()
  }
})

// Handle errors
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker error:', event.error)
})

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker unhandled rejection:', event.reason)
})
