export interface Room {
  id: string
  name: string
  slug: string
  description: string
  public: boolean
  agentCount: number
  messageCount: number
  tags: string[]
  createdAt: string
  updatedAt: string
  ownerId: string | null
  active: boolean
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
  bearerToken?: string
  url: string
}

export interface CreateRoomRequest {
  name: string
  public: boolean
  description?: string
  tags?: string[]
}

export interface CreateRoomResponse {
  room: Room
  url: string
  token: string
}

export interface ApiError {
  error: string
  code?: string
}

export interface SessionPayload {
  sub: string
  email: string
  name: string
  exp: number
}
