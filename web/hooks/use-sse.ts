"use client"
import { useEffect, useRef, useState } from "react"

interface UseSSEOptions {
  onMessage?: (event: MessageEvent) => void
  onEvent?: Record<string, (event: MessageEvent) => void>
}

export function useSSE(url: string | null, options: UseSSEOptions = {}) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!url) return

    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.onopen = () => { setConnected(true); setError(false) }
    es.onerror = () => { setConnected(false); setError(true) }

    if (options.onMessage) {
      es.onmessage = options.onMessage
    }
    if (options.onEvent) {
      for (const [eventName, handler] of Object.entries(options.onEvent)) {
        es.addEventListener(eventName, handler)
      }
    }

    return () => { es.close(); setConnected(false) }
  }, [url])

  return { connected, error }
}
