
'use client'; // This file might be imported by client components indirectly

import * as IRC from 'irc-framework';
import type { ServerConnection, Message, User, Channel, AvailableChannelInfo } from '@/lib/types';

export type IrcServiceEventCallbacks = {
  onConnect: (serverId: string) => void;
  onDisconnect: (serverId: string, reason?: string) => void;
  onError: (serverId: string, error: { type: string; message: string; [key: string]: any }) => void;
  onServerMessage: (serverId: string, message: Message) => void;
  onChannelMessage: (serverId: string, message: Message) => void;
  onUserJoinedChannel: (serverId: string, channelName: string, nick: string, user: User) => void;
  onUserPartedChannel: (serverId: string, channelName: string, nick: string, reason?: string) => void;
  onUserQuit: (serverId: string, nick: string, reason?: string, channels: string[]) => void;
  onNickChange: (serverId: string, oldNick: string, newNick: string, channels: string[]) => void;
  onTopicChange: (serverId: string, channelName: string, topic: string, nick?: string) => void;
  onChannelUserList: (serverId: string, channelName: string, users: User[]) => void;
  onAvailableChannelsStart: (serverId: string) => void;
  onAvailableChannelItem: (serverId: string, channel: AvailableChannelInfo) => void;
  onAvailableChannelsEnd: (serverId: string) => void;
  onModeChange: (serverId: string, target: string, nick: string, modes: string, params: string[]) => void;
  onKick: (serverId: string, channel: string, nick: string, by: string, reason?: string) => void;
};

export class IrcService {
  private client: IRC.Client | null = null;
  private serverId: string | null = null;
  private currentNick: string | null = null;

  constructor(private callbacks: IrcServiceEventCallbacks) {}

  public connect(details: Omit<ServerConnection, "id" | "isConnected" | "isConnecting"> & {id: string}): void {
    if (this.client) {
      this.disconnect('Reconnecting...');
    }

    this.client = new IRC.Client();
    this.serverId = details.id;
    this.currentNick = details.nickname;

    const isBrowser = typeof window !== 'undefined';
    let shouldUseTLS = details.port === 6697 || details.port === 9999 || details.port === 443; // Standard TLS/WSS ports

    // Override to WSS if on HTTPS page in browser
    if (isBrowser && window.location.protocol === 'https:') {
        shouldUseTLS = true;
    }

    this.client.connect({
      host: details.host,
      port: details.port,
      nick: details.nickname,
      username: details.nickname, // Use nickname for username as fallback
      gecos: details.realName || 'ViteChat User',
      password: details.password,
      auto_reconnect: false, // Disable auto-reconnect for manual control
      auto_reconnect_max_wait: 30000,
      auto_reconnect_max_retries: 3,
      version: 'ViteChat 0.5.0 - https://vitechat.dev', // Advertise client version
      encoding: 'utf8', // Standard encoding
      tls: shouldUseTLS,
      websocket: isBrowser, // Explicitly use WebSockets if in a browser environment
      rejectUnauthorized: false, // TODO: Make this configurable or true in production
    });

    this.registerEvents();
  }

  public disconnect(reason: string = 'Client disconnected'): void {
    const currentServerId = this.serverId; // Capture serverId before potential nullification

    if (this.client) {
      const localClient = this.client; // Capture client instance for cleanup

      // Check if client still has a connection before trying to quit
      // irc-framework's `connected` property can be used
      if (localClient.connected) {
        localClient.quit(reason);
        // Note: 'close' event handler will handle nullifying this.client and calling onDisconnect
      } else {
        // If not connected (or connection failed), manually trigger callback and clean up.
        // The 'close' event might not fire in these cases.
        if (currentServerId) {
            this.callbacks.onDisconnect(currentServerId, reason);
        }
        // Safely remove listeners if the client object still exists
        try {
            localClient.removeAllListeners();
        } catch (e) {
             console.error("Error removing listeners during disconnect:", e);
             // Continue cleanup even if removing listeners fails
        }
        // Nullify client immediately as it's not connected and 'close' won't fire reliably
        this.client = null;
      }
    }

    // Ensure state is reset even if client was already null or disconnect logic had issues
    this.serverId = null;
    this.currentNick = null;
  }


  private registerEvents(): void {
    if (!this.client || !this.serverId) return;

    const serverId = this.serverId; // Capture for closure safety

    this.client.on('registered', () => {
      // Check if the serverId still matches the one from connect() context
      if (this.serverId === serverId) {
          this.callbacks.onConnect(serverId);
          this.listChannels(); // Fetch channel list on successful registration
      }
    });

    // Centralized 'close' handler
    this.client.on('close', (event) => {
      const reason = event && event.reason ? event.reason : 'Connection closed';
      // Ensure we only call disconnect callback if serverId matches
      // and that this.client is the one that closed.
      if (this.serverId === serverId ) {
          this.callbacks.onDisconnect(serverId, reason);
          this.client = null; // Critical: ensure client is nullified after close
          this.serverId = null; // Also reset serverId here for consistency
          this.currentNick = null;
      }
    });

    // Handle abrupt socket closures that might not trigger the main 'close' event cleanly
    this.client.on('socket close', () => {
        // Check if the client instance still matches the one associated with this serverId
        if (this.client && this.serverId === serverId) {
            this.callbacks.onDisconnect(serverId, 'Socket closed abruptly');
            this.client = null;
            this.serverId = null;
            this.currentNick = null;
        }
    });

    this.client.on('error', (err) => {
       // Ensure error belongs to current context
       if (this.serverId === serverId) {
         this.callbacks.onError(serverId, { type: err.type || 'UnknownError', message: err.message, ...err });
       }
    });

    // Handle NOTICE messages - could be from server or user
    const handleServerNotice = (event: IRC.Event_Notice) => {
        if (this.serverId !== serverId) return; // Ignore if server context changed

        // Route notices to server log if:
        // - target is self
        // - sender is the server host (simplistic check)
        // - target is not a channel (#)
        if (!this.currentNick || event.target.toLowerCase() === this.currentNick.toLowerCase() || event.nick === serverId.split(':')[0] || !event.target.startsWith('#')) {
             this.callbacks.onServerMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                nickname: event.nick, // Might be server name or user nick
                content: event.message,
                type: 'notice',
                channelId: serverId, // Associate with server log
                target: event.target,
             });
        } else if (event.target.startsWith('#')) { // Notice to a specific channel
            this.callbacks.onChannelMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: event.network_time || Date.now(),
                nickname: event.nick, // Can be a user or a server service
                content: event.message,
                type: 'notice',
                channelId: `${serverId}${event.target.toLowerCase()}`,
                target: event.target.toLowerCase(),
                isSelf: false, // Notices are typically not self-inflicted this way
            });
        }
    };
    this.client.on('notice', handleServerNotice);

    // Handle Message of the Day (MOTD)
    this.client.on('motd', (event) => {
      if (this.serverId !== serverId) return;
      event.motd.split('\n').forEach(line => {
        this.callbacks.onServerMessage(serverId, {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          content: line,
          type: 'info', // Treat MOTD lines as info
          channelId: serverId,
          target: serverId,
        });
      });
    });

    // Handle raw IRC lines (mostly for debugging or unhandled numerics)
    this.client.on('raw', (event) => {
        if (this.serverId !== serverId) return;
        // Only log numeric replies not commonly handled by specific events
        if (event.command && typeof event.command === 'string' && /^\d{3}$/.test(event.command)) {
            const numericCommand = parseInt(event.command, 10);
            // Filter out common numerics handled elsewhere (welcome, motd, etc.)
            const ignoredNumerics = [
                1, 2, 3, 4, 5, // RPL_WELCOME, RPL_YOURHOST, RPL_CREATED, RPL_MYINFO, RPL_ISUPPORT
                250, 251, 252, 253, 254, 255, // RPL_STATS*, RPL_LUSER*
                265, 266, // RPL_LOCALUSERS, RPL_GLOBALUSERS
                301, // RPL_AWAY
                305, 306, // RPL_UNAWAY, RPL_NOWAWAY
                311, 312, 313, 317, 318, 319, 378, // RPL_WHOIS*
                321, 322, 323, // RPL_LISTSTART, RPL_LIST, RPL_LISTEND
                331, 332, // RPL_NOTOPIC, RPL_TOPIC
                353, // RPL_NAMREPLY
                366, // RPL_ENDOFNAMES
                372, 375, 376, // RPL_MOTD, RPL_MOTDSTART, RPL_ENDOFMOTD
            ];
            if (!ignoredNumerics.includes(numericCommand)) {
                 this.callbacks.onServerMessage(serverId, {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    content: `(${event.command}) ${event.params.slice(1).join(' ')}`,
                    type: 'raw', // Mark as raw server message
                    channelId: serverId,
                    target: serverId,
                    rawLine: event.line,
                 });
            }
        }
        // Could potentially log non-numeric commands here too if needed
    });


    // Handle PRIVMSG (channel messages and private messages)
    this.client.on('message', (event) => {
      if (this.serverId !== serverId) return;
      const isSelf = event.nick.toLowerCase() === this.currentNick?.toLowerCase();

      if (event.target.startsWith('#')) { // Channel message
        this.callbacks.onChannelMessage(serverId, {
          id: crypto.randomUUID(),
          timestamp: event.network_time || Date.now(),
          nickname: event.nick,
          content: event.message,
          type: 'message',
          channelId: `${serverId}${event.target.toLowerCase()}`,
          target: event.target.toLowerCase(),
          isSelf: isSelf,
        });
      } else { // Private message (target is own nick)
         // We need to associate this PM with the *sender's* nick for the "channel" representation
         this.callbacks.onChannelMessage(serverId, {
          id: crypto.randomUUID(),
          timestamp: event.network_time || Date.now(),
          nickname: event.nick,
          content: event.message,
          type: 'message',
          channelId: `${serverId}${event.nick.toLowerCase()}`, // Associate PM with sender's nick "channel"
          target: event.nick.toLowerCase(), // Target for the message is the sender in PM context
          isSelf: false, // A received PM is never from self
        });
      }
    });

    // Handle CTCP ACTION (/me command)
    this.client.on('action', (event) => {
         if (this.serverId !== serverId) return;
         const isSelf = event.nick.toLowerCase() === this.currentNick?.toLowerCase();

         if (event.target.startsWith('#')) { // Channel action
            this.callbacks.onChannelMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: event.network_time || Date.now(),
                nickname: event.nick,
                content: event.message, // Content is the action text
                type: 'action',
                channelId: `${serverId}${event.target.toLowerCase()}`,
                target: event.target.toLowerCase(),
                isSelf: isSelf,
            });
        }  else { // Private message action
            this.callbacks.onChannelMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: event.network_time || Date.now(),
                nickname: event.nick,
                content: event.message,
                type: 'action',
                channelId: `${serverId}${event.nick.toLowerCase()}`, // Associate PM with sender's nick "channel"
                target: event.nick.toLowerCase(),
                isSelf: false, // Received action is not from self
            });
        }
    });

    // Respond to standard CTCP requests
    this.client.on('ctcp request', (event) => {
        if (this.client && this.serverId === serverId) { // Check client exists and context matches
            if (event.command === 'VERSION') {
                this.client.ctcpResponse(event.nick, 'VERSION', 'ViteChat 0.5.0 - A modern IRC client');
            } else if (event.command === 'PING') {
                this.client.ctcpResponse(event.nick, 'PING', event.params);
            }
            // Could add TIME, etc. if desired
        }
    });


    // Handle user joining a channel
    this.client.on('join', (event) => {
      if (this.serverId !== serverId) return;
      const user: User = { id: event.nick, nickname: event.nick, username: event.ident, hostname: event.hostname };
      this.callbacks.onUserJoinedChannel(serverId, event.channel.toLowerCase(), event.nick, user);
      // If self joined, request NAMES list to get full user list + modes
      if (event.nick.toLowerCase() === this.currentNick?.toLowerCase()) {
        this.client?.sendRaw(`NAMES ${event.channel}`);
      }
    });

    // Handle user parting a channel
    this.client.on('part', (event) => {
      if (this.serverId !== serverId) return;
      this.callbacks.onUserPartedChannel(serverId, event.channel.toLowerCase(), event.nick, event.message);
    });

    // Handle user quitting the server
    this.client.on('quit', (event) => {
      if (this.serverId !== serverId) return;
      this.callbacks.onUserQuit(serverId, event.nick, event.message, event.channels.map(c => c.toLowerCase()));
    });

    // Handle user being kicked from a channel
    this.client.on('kick', (event) => {
        if (this.serverId !== serverId) return;
        this.callbacks.onKick(serverId, event.channel.toLowerCase(), event.kicked, event.nick, event.message);
    });

    // Handle nickname changes
    this.client.on('nick', (event) => {
      if (this.serverId !== serverId) return;
      // Update internal currentNick if self changed nick
      if (this.currentNick && event.nick.toLowerCase() === this.currentNick.toLowerCase()) {
        this.currentNick = event.new_nick;
      }
      this.callbacks.onNickChange(serverId, event.nick, event.new_nick, event.channels.map(c => c.toLowerCase()));
    });

    // Handle channel topic changes
    this.client.on('topic', (event) => {
      if (this.serverId !== serverId) return;
      this.callbacks.onTopicChange(serverId, event.channel.toLowerCase(), event.topic, event.nick);
    });

    // Handle initial user list from JOIN (less reliable for modes)
    this.client.on('userlist', (event) => {
      if (this.serverId !== serverId) return;
      const users: User[] = event.users.map(u => ({
        id: u.nick,
        nickname: u.nick,
        username: u.ident,
        hostname: u.hostname,
        modes: u.modes || [],
        // Map common prefixes to op/voice status
        isOp: u.modes?.some(mode => ['~', '&', '@', '%', 'q', 'a', 'o'].includes(mode)), // Owner, Admin, Op, HalfOp etc.
        isVoice: u.modes?.includes('+') || u.modes?.includes('v'),
      }));
      this.callbacks.onChannelUserList(serverId, event.channel.toLowerCase(), users);
    });

    // Handle user list from NAMES (more reliable for modes)
     this.client.on('names', (event) => {
      if (this.serverId !== serverId) return;
      const users: User[] = event.users.map(u => ({
        id: u.nick,
        nickname: u.nick,
        username: u.ident, // Usually not present in NAMES reply, keep structure
        hostname: u.host, // Available as u.host in 'names'
        modes: u.modes || [], // Prefixes like @, +
        isOp: u.modes?.some(mode => ['~', '&', '@', '%', 'q', 'a', 'o'].includes(mode)),
        isVoice: u.modes?.includes('+') || u.modes?.includes('v'),
      }));
      // Note: NAMES event often fires per channel, might overwrite previous lists
      // if multiple NAMES requests are pending. Consider accumulating if necessary,
      // but usually a fresh list is desired.
      this.callbacks.onChannelUserList(serverId, event.channel.toLowerCase(), users);
    });


    // Handle start of LIST command response
    this.client.on('channel list start', () => {
      if (this.serverId !== serverId) return;
      this.callbacks.onAvailableChannelsStart(serverId);
    });

    // Handle individual channel item from LIST
    this.client.on('channel list item', (event) => {
      if (this.serverId !== serverId) return;
      this.callbacks.onAvailableChannelItem(serverId, {
        id: `${serverId}${event.channel.toLowerCase()}`, // Unique ID
        serverId: serverId,
        name: event.channel, // Keep original casing for display? Lowercase for ID.
        userCount: event.users,
        topic: event.topic,
        modes: event.modes_string, // Raw modes string like "[+nt]"
      });
    });

    // Handle end of LIST command response
    this.client.on('channel list end', () => {
      if (this.serverId !== serverId) return;
      this.callbacks.onAvailableChannelsEnd(serverId);
    });

    // Handle MODE changes (channel or user)
    this.client.on('mode', (event) => {
        if (this.serverId !== serverId) return;
        // Construct a readable modes string like "+o user1 -v user2"
        const modesString = event.modes.map(m => m.mode + (m.param ? ` ${m.param}` : '')).join(' ');
        // Extract parameters for easier processing in UI if needed
        const params = event.modes.map(m => m.param).filter(Boolean) as string[];
        // Target can be channel or user nick
        this.callbacks.onModeChange(serverId, event.target.toLowerCase(), event.nick, modesString, params);
    });
  }

  // --- Public Methods ---

  public joinChannel(channelName: string): void {
    if (this.client && this.client.connected && channelName) {
        // Ensure channel name starts with # (or other valid prefix if needed)
        const properChannelName = channelName.startsWith('#') ? channelName : `#${channelName}`;
        this.client.join(properChannelName);
    } else {
        console.warn("Cannot join channel: Client not connected or channel name invalid.");
        // Optionally notify UI: this.callbacks.onError(...)
    }
  }

  public partChannel(channelName: string, reason?: string): void {
    if (this.client && this.client.connected) {
        this.client.part(channelName, reason || 'Leaving channel');
    } else {
        console.warn("Cannot part channel: Client not connected.");
        // Optionally notify UI: this.callbacks.onError(...)
    }
  }

  public sendMessage(target: string, message: string): void {
    if (this.client && this.client.connected && target && message) {
        // Handle common slash commands locally before sending
        if (message.startsWith('/me ')) {
            const actionMsg = message.substring(4);
            if (actionMsg) this.client.action(target, actionMsg);
        } else if (message.startsWith('/notice ')) {
            const parts = message.match(/^\/notice\s+(\S+)\s+(.+)/); // Match /notice <target> <message>
            if (parts && parts[1] && parts[2]) {
                this.client.notice(parts[1], parts[2]);
            } else {
                // Handle error: Invalid notice command format
                this.callbacks.onError(this.serverId!, { type: 'CommandError', message: 'Invalid /notice format. Use /notice <target> <message>' });
            }
        } else if (message.startsWith('/query ')) {
             const parts = message.match(/^\/query\s+(\S+)/); // Match /query <nick>
             if (parts && parts[1]) {
                 const queryNick = parts[1];
                 // In a UI, this would typically open a new PM tab/window.
                 // We don't send a message here, just acknowledge the intent.
                  this.callbacks.onServerMessage(this.serverId!, {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    content: `Query requested with ${queryNick}. Select their name in the sidebar to chat.`,
                    type: 'info',
                    channelId: this.serverId!,
                    target: this.serverId!,
                  });
                  // Potentially trigger UI event to focus/create the PM view
             } else {
                this.callbacks.onError(this.serverId!, { type: 'CommandError', message: 'Invalid /query format. Use /query <nickname>' });
             }
        }
        // TODO: Add more commands like /kick, /mode, /topic etc.
        else {
            // Default: send as PRIVMSG
            this.client.privmsg(target, message);
        }
    } else {
        console.warn("Cannot send message: Client not connected or target/message invalid.");
         if(this.serverId) {
            this.callbacks.onError(this.serverId, { type: 'SendError', message: 'Not connected to server.' });
         }
    }
  }

  public listChannels(): void {
    if (this.client && this.client.connected) {
        this.client.list();
    } else {
        console.warn("Cannot list channels: Client not connected.");
        // Optionally notify UI: this.callbacks.onError(...)
    }
  }

  public changeNick(newNickname: string): void {
    if (this.client && this.client.connected && newNickname && newNickname !== this.currentNick) {
        this.client.nick(newNickname);
        // Nick change confirmation happens via the 'nick' event
    } else if (newNickname === this.currentNick) {
         // Inform user they already have this nick
         if(this.serverId) {
            this.callbacks.onServerMessage(this.serverId, {
                 id: crypto.randomUUID(),
                 timestamp: Date.now(),
                 content: `You are already known as ${newNickname}.`,
                 type: 'info',
                 channelId: this.serverId,
                 target: this.serverId,
            });
         }
    }
     else {
        console.warn("Cannot change nick: Client not connected or new nickname invalid.");
        // Optionally notify UI: this.callbacks.onError(...)
    }
  }

  // Send a raw IRC command string
  public sendRaw(command: string): void {
    if (this.client && this.client.connected && command) {
        this.client.raw(command);
    } else {
         console.warn("Cannot send raw command: Client not connected or command empty.");
         // Optionally notify UI: this.callbacks.onError(...)
    }
  }
}

    