import { createContext, useContext } from 'react'

/** Contexto de notificaciones; el proveedor vive en context/NotificationsContext.jsx */
export const NotificationsContext = createContext(null)

export function useNotifications() {
  return useContext(NotificationsContext)
}
