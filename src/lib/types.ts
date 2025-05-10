export interface ServerConnection {
  id: string;
  host: string;
  port: number;
  nickname: string;
  password?: string;
  realName?: string;
  email?: string;
  isConnected: boolean;
}

export interface Channel {
  id: string; // serverId#channelName
  serverId: string;
  name: string;
  topic?: string;
  users: User[];
  messages: Message[];
}

export interface AvailableChannelInfo {
  id: string; // serverId#channelName
  serverId: string;
  name: string;
  topic?: string;
  userCount?: number;
}

export interface User {
  id: string; // nickname
  nickname: string;
  // Future: modes, etc.
}

export interface Message {
  id: string;
  timestamp: number;
  nickname?: string; // System messages might not have a nickname
  content: string;
  type: 'message' | 'join' | 'part' | 'quit' | 'nick' | 'system' | 'error' | 'info';
  channelId: string; // For channel messages, this is serverId#channelName. For server-wide messages, this can be serverId.
  isSelf?: boolean;
}
