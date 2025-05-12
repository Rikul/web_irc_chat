export interface ServerConnection {
  id: string; // Typically host:port
  host: string;
  port: number;
  nickname: string;
  password?: string;
  realName?: string;
  email?: string; // Less common in modern IRC, but kept for form
  isConnected: boolean;
  isConnecting?: boolean; // To show loading/connecting state
  awayMessage?: string;
}

export interface Channel {
  id: string; // serverId + channelName (e.g., "irc.libera.chat#vitechat")
  serverId: string;
  name: string; // e.g., "#vitechat"
  topic?: {
    text: string;
    setter?: string; // Nick of who set the topic
    timestamp?: number;
  };
  users: User[];
  messages: Message[];
  modes?: string[]; // Channel modes like +n, +t, etc.
  createdAt?: number; // Channel creation timestamp if available
}

export interface AvailableChannelInfo {
  id: string; // serverId + channelName
  serverId: string;
  name: string;
  topic?: string;
  userCount?: number;
  modes?: string; // Raw modes string from LIST command
}

export interface User {
  id: string; // Typically nickname, but needs to handle NICK changes
  nickname: string;
  username?: string; // ident
  hostname?: string;
  realname?: string; // GECOS
  modes?: string[]; // User modes on a channel (e.g., @ for op, + for voice)
  away?: boolean;
  awayMessage?: string;
  isOp?: boolean; // Helper derived from modes
  isVoice?: boolean; // Helper derived from modes
}

export interface Message {
  id: string; // Unique ID for React key
  timestamp: number;
  nickname?: string; // Sender's nickname. Can be server name for notices.
  target: string; // Channel name or own nickname (for private messages/notices)
  content: string;
  type: 'message' | 'notice' | 'action' | 'join' | 'part' | 'quit' | 'kick' | 'nick' | 'mode' | 'topic' | 'system' | 'error' | 'info' | 'raw';
  channelId: string; // For channel messages, this is serverId#channelName. For server-wide messages, this can be serverId.
  isSelf?: boolean;
  // For specific message types
  oldNickname?: string; // For NICK changes
  kicked?: string; // For KICK messages (who was kicked)
  kickReason?: string; // For KICK messages
  modeParams?: string[]; // For MODE messages
  rawLine?: string; // For RAW type
}
