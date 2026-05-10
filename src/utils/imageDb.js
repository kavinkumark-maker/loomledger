// ── IndexedDB wrapper for image storage ───────────────────────────────────────
// Images are stored separately from localStorage to avoid size limits.
// Each image is keyed by costingId + imageId.

const DB_NAME    = 'LoomLedgerImages'
const DB_VERSION = 1
const STORE_NAME = 'images'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function saveImage(costingId, imageId, dataUrl, meta = {}) {
  const db  = await openDb()
  const key = `${costingId}__${imageId}`
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ key, costingId, imageId, dataUrl, ...meta })
    tx.oncomplete = () => resolve()
    tx.onerror    = e => reject(e.target.error)
  })
}

export async function getImages(costingId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE_NAME, 'readonly')
    const store   = tx.objectStore(STORE_NAME)
    const results = []
    const req     = store.openCursor()
    req.onsuccess = e => {
      const cursor = e.target.result
      if (cursor) {
        if (cursor.value.costingId === costingId) results.push(cursor.value)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    req.onerror = e => reject(e.target.error)
  })
}

export async function deleteImage(costingId, imageId) {
  const db  = await openDb()
  const key = `${costingId}__${imageId}`
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror    = e => reject(e.target.error)
  })
}

export async function deleteAllImages(costingId) {
  const images = await getImages(costingId)
  for (const img of images) await deleteImage(costingId, img.imageId)
}

// ── Client-side image compression ────────────────────────────────────────────
export function compressImage(file, maxWidth = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale  = Math.min(1, maxWidth / img.width)
        canvas.width  = img.width  * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
