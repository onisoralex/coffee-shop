import { useEffect, useRef, useState } from 'react'
import { getSocket } from './useSocket.js'

// Calls onConnect on every socket connection — first connect and every reconnect.
// Returns { reconnected } which stays true for 3 seconds after any connection that
// isn't the very first, so views can show a "reconnected" toast without flashing it
// on the initial page load.
//
// If the socket is already connected when this hook mounts (the singleton connects at
// module load time), onConnect fires immediately so the view always hydrates.
export function useReconnect(onConnect: () => void): { reconnected: boolean } {
  const [reconnected, setReconnected] = useState(false)
  const hasConnectedRef = useRef(false)
  const callbackRef = useRef(onConnect)
  callbackRef.current = onConnect

  useEffect(() => {
    const socket = getSocket()

    const handleConnect = () => {
      callbackRef.current()
      if (hasConnectedRef.current) setReconnected(true)
      hasConnectedRef.current = true
    }

    if (socket.connected) handleConnect()
    socket.on('connect', handleConnect)
    return () => { socket.off('connect', handleConnect) }
  }, [])

  useEffect(() => {
    if (!reconnected) return
    const id = setTimeout(() => setReconnected(false), 3000)
    return () => clearTimeout(id)
  }, [reconnected])

  return { reconnected }
}
