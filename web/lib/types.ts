// Types matching the actual Go API response shapes

export interface Room {
  slug: string
  display_name: string
  description?: string
  tags: string[]
  is_private: boolean
  agent_count: number
  url: string
  a2a_url: string
  created_at: string
}

export interface Agent {
  id: string
  name: string
  description: string
  skills: string[]
  tags: string[]
  joinedAt: string
}

export interface Stats {
  activeRooms: number
  agentsOnline: number
  messagesRelayed: number
}

export interface RoomDetail extends Room {
  agents: Agent[]
  bearer_token?: string
}

export interface CreateRoomRequest {
  name: string
  public?: boolean
  description?: string
  tags?: string[]
}

export interface CreateRoomResponse {
  slug: string
  display_name: string
  url: string
  a2a_url: string
  bearer_token: string
  expires_at?: string
}

export interface ApiError {
  error: string
  message?: string
}

export interface SessionPayload {
  sub: string
  email: string
  name: string
  exp: number
}
