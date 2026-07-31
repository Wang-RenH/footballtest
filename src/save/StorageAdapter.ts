/** 存储适配层：Web 用 localStorage，微信小游戏可替换实现 */

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const webStorage: StorageAdapter = {
  getItem(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* quota / private mode */
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

let adapter: StorageAdapter = webStorage

export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next
}

export function getStorage(): StorageAdapter {
  return adapter
}
