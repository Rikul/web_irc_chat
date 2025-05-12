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

    if (isBrowser && window.location.protocol === 'https:') {
        // If in browser on an HTTPS page, WebSocket connections MUST be WSS for security.
        // This means the 'tls' option for irc-framework (when using WebSockets) must be true.
        shouldUseTLS = true;
    }

    this.client.connect({
      host: details.host,
      port: details.port,
      nick: details.nickname,
      username: details.nickname, 
      gecos: details.realName || 'ViteChat User',
      password: details.password,
      auto_reconnect: false, 
      auto_reconnect_max_wait: 30000,
      auto_reconnect_max_retries: 3,
      version: 'ViteChat 0.5.0 - https://vitechat.dev', 
      encoding: 'utf8', 
      tls: shouldUseTLS,
      websocket: isBrowser, // Explicitly use WebSockets if in a browser environment
      rejectUnauthorized: false, // TODO: Make this configurable or true in production
    });

    this.registerEvents();
  }

  public disconnect(reason: string = 'Client disconnected'): void {
    if (this.client) {
      // Check if client still has a connection before trying to quit
      // irc-framework's `connected` property can be used
      if (this.client.connected) {
        this.client.quit(reason);
      } else {
        // If not connected, forcefully clean up
        this.client.internalEvents.emit('close', {reason: reason, error: false });
        this.client.removeAllListeners(); // Clean up listeners to prevent leaks
      }
    }
    // Nullify client regardless of connected state, as we are intending to disconnect.
    // The 'close' event handler (if it fires) will also set this.client to null.
    // This ensures cleanup even if 'close' doesn't fire (e.g. client was never fully connected).
    if(this.client) { // only nullify if not already nullified by an event
        this.client = null; 
    }
    this.serverId = null; // serverId is already nullable
    this.currentNick = null; // currentNick is already nullable
  }

  private registerEvents(): void {
    if (!this.client || !this.serverId) return;

    const serverId = this.serverId; 

    this.client.on('registered', () => {
      this.callbacks.onConnect(serverId);
      this.listChannels(); 
    });

    this.client.on('close', (event) => {
      const reason = event && event.reason ? event.reason : 'Connection closed';
      // Ensure we only call disconnect callback if serverId matches (it should)
      // and that this.client is the one that closed.
      if (this.serverId === serverId ) { 
          this.callbacks.onDisconnect(serverId, reason);
          this.client = null; // Critical: ensure client is nullified after close
      }
    });
    
    this.client.on('socket close', () => {
        if (this.client && this.serverId === serverId) { 
            this.callbacks.onDisconnect(serverId, 'Socket closed abruptly');
            this.client = null;
        }
    });

    this.client.on('error', (err) => {
       if (this.serverId === serverId) { // Ensure error belongs to current context
         this.callbacks.onError(serverId, { type: err.type || 'UnknownError', message: err.message, ...err });
       }
    });

    const handleServerNotice = (event: IRC.Event_Notice) => {
        if (!this.currentNick || event.target.toLowerCase() === this.currentNick.toLowerCase() || event.nick === serverId.split(':')[0] || !event.target.startsWith('#')) {
             this.callbacks.onServerMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                nickname: event.nick, 
                content: event.message,
                type: 'notice',
                channelId: serverId, 
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

    this.client.on('motd', (event) => {
      event.motd.split('\n').forEach(line => {
        this.callbacks.onServerMessage(serverId, {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          content: line,
          type: 'info',
          channelId: serverId,
          target: serverId,
        });
      });
    });

    this.client.on('raw', (event) => {
        if (event.command && typeof event.command === 'string' && /^\d{3}$/.test(event.command)) {
            const numericCommand = parseInt(event.command, 10);
            if (![1,2,3,4,5, 250,251,252,253,254,255, 265, 266, 372,375,376].includes(numericCommand)) {
                 this.callbacks.onServerMessage(serverId, {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    content: `${event.command} ${event.params.slice(1).join(' ')}`,
                    type: 'raw',
                    channelId: serverId,
                    target: serverId,
                    rawLine: event.line,
                 });
            }
        }
    });

    this.client.on('message', (event) => {
      if (event.target.startsWith('#')) { 
        this.callbacks.onChannelMessage(serverId, {
          id: crypto.randomUUID(),
          timestamp: event.network_time || Date.now(),
          nickname: event.nick,
          content: event.message,
          type: 'message',
          channelId: `${serverId}${event.target.toLowerCase()}`,
          target: event.target.toLowerCase(),
          isSelf: event.nick.toLowerCase() === this.currentNick?.toLowerCase(),
        });
      } else { 
         this.callbacks.onChannelMessage(serverId, { 
          id: crypto.randomUUID(),
          timestamp: event.network_time || Date.now(),
          nickname: event.nick,
          content: event.message,
          type: 'message',
          channelId: `${serverId}${event.nick.toLowerCase()}`, 
          target: event.nick.toLowerCase(), 
          isSelf: false, 
        });
      }
    });

    this.client.on('action', (event) => {
         if (event.target.startsWith('#')) {
            this.callbacks.onChannelMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: event.network_time || Date.now(),
                nickname: event.nick,
                content: event.message,
                type: 'action',
                channelId: `${serverId}${event.target.toLowerCase()}`,
                target: event.target.toLowerCase(),
                isSelf: event.nick.toLowerCase() === this.currentNick?.toLowerCase(),
            });
        }  else { // PM action
            this.callbacks.onChannelMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: event.network_time || Date.now(),
                nickname: event.nick,
                content: event.message,
                type: 'action',
                channelId: `${serverId}${event.nick.toLowerCase()}`,
                target: event.nick.toLowerCase(),
                isSelf: false,
            });
        }
    });
    
    this.client.on('ctcp request', (event) => {
        if (this.client) { // Check if client still exists
            if (event.command === 'VERSION') {
                this.client.ctcpResponse(event.nick, 'VERSION', 'ViteChat 0.5.0 - A modern IRC client');
            } else if (event.command === 'PING') {
                this.client.ctcpResponse(event.nick, 'PING', event.params);
            }
        }
    });

    this.client.on('join', (event) => {
      const user: User = { id: event.nick, nickname: event.nick, username: event.ident, hostname: event.hostname };
      this.callbacks.onUserJoinedChannel(serverId, event.channel.toLowerCase(), event.nick, user);
      if (event.nick.toLowerCase() === this.currentNick?.toLowerCase()) {
        this.client?.names(event.channel); 
      }
    });

    this.client.on('part', (event) => {
      this.callbacks.onUserPartedChannel(serverId, event.channel.toLowerCase(), event.nick, event.message);
    });

    this.client.on('quit', (event) => {
      this.callbacks.onUserQuit(serverId, event.nick, event.message, event.channels.map(c => c.toLowerCase()));
    });

    this.client.on('kick', (event) => {
        this.callbacks.onKick(serverId, event.channel.toLowerCase(), event.kicked, event.nick, event.message);
    });

    this.client.on('nick', (event) => {
      if (this.currentNick && event.nick.toLowerCase() === this.currentNick.toLowerCase()) {
        this.currentNick = event.new_nick;
      }
      this.callbacks.onNickChange(serverId, event.nick, event.new_nick, event.channels.map(c => c.toLowerCase()));
    });

    this.client.on('topic', (event) => {
      this.callbacks.onTopicChange(serverId, event.channel.toLowerCase(), event.topic, event.nick);
    });

    this.client.on('userlist', (event) => { 
      const users: User[] = event.users.map(u => ({
        id: u.nick,
        nickname: u.nick,
        username: u.ident,
        hostname: u.hostname,
        modes: u.modes || [],
        isOp: u.modes?.includes('@') || u.modes?.includes('o') || u.modes?.includes('~') || u.modes?.includes('&') || u.modes?.includes('q'), // Standard op-like prefixes
        isVoice: u.modes?.includes('+') || u.modes?.includes('v'),
      }));
      this.callbacks.onChannelUserList(serverId, event.channel.toLowerCase(), users);
    });
     this.client.on('names', (event) => { 
      const users: User[] = event.users.map(u => ({
        id: u.nick,
        nickname: u.nick,
        username: u.ident, // Not available in NAMES, but keep structure
        hostname: u.host, // Available as u.host in 'names'
        modes: u.modes || [], // Prefixes like @, +
        isOp: u.modes?.includes('@') || u.modes?.includes('o') || u.modes?.includes('~') || u.modes?.includes('&') || u.modes?.includes('q'),
        isVoice: u.modes?.includes('+') || u.modes?.includes('v'),
      }));
      this.callbacks.onChannelUserList(serverId, event.channel.toLowerCase(), users);
    });

    this.client.on('channel list start', () => {
      this.callbacks.onAvailableChannelsStart(serverId);
    });

    this.client.on('channel list item', (event) => {
      this.callbacks.onAvailableChannelItem(serverId, {
        id: `${serverId}${event.channel.toLowerCase()}`,
        serverId: serverId,
        name: event.channel, 
        userCount: event.users,
        topic: event.topic,
        modes: event.modes_string,
      });
    });

    this.client.on('channel list end', () => {
      this.callbacks.onAvailableChannelsEnd(serverId);
    });

    this.client.on('mode', (event) => {
        const modesString = event.modes.map(m => m.mode + (m.param ? ` ${m.param}` : '')).join(' ');
        const params = event.modes.map(m => m.param).filter(Boolean) as string[];
        this.callbacks.onModeChange(serverId, event.target.toLowerCase(), event.nick, modesString, params);
    });
  }

  public joinChannel(channelName: string): void {
    if (this.client && this.client.connected && channelName) {
        const properChannelName = channelName.startsWith('#') ? channelName : `#${channelName}`;
        this.client.join(properChannelName);
    }
  }

  public partChannel(channelName: string, reason?: string): void {
    if (this.client && this.client.connected) {
        this.client.part(channelName, reason || 'Leaving channel');
    }
  }

  public sendMessage(target: string, message: string): void {
    if (this.client && this.client.connected) {
        if (message.startsWith('/me ')) {
            this.client.action(target, message.substring(4));
        } else if (message.startsWith('/notice ')) {
            const parts = message.split(' ');
            const noticeTarget = parts[1];
            const noticeMessage = parts.slice(2).join(' ');
            if (noticeTarget && noticeMessage) {
                this.client.notice(noticeTarget, noticeMessage);
            }
        } else if (message.startsWith('/query ')) {
             const parts = message.split(' ');
             const queryNick = parts[1];
             if (queryNick && this.serverId) {
                 // This doesn't send a message, it "opens a query window"
                 // For our app, this means selecting/creating a PM channel.
                 // The actual message sending will happen via normal privmsg.
                 // So, this is more of a UI hint. We can emit a special event or handle in UI.
                 // For now, just log that a query was attempted.
                  this.callbacks.onServerMessage(this.serverId, {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    content: `Query requested with ${queryNick}. Send messages directly to them.`,
                    type: 'info',
                    channelId: this.serverId,
                    target: this.serverId,
                  });
             }
        }
        else {
            this.client.privmsg(target, message);
        }
    }
  }

  public listChannels(): void {
    if (this.client && this.client.connected) {
        this.client.list();
    }
  }

  public changeNick(newNickname: string): void {
    if (this.client && this.client.connected && newNickname && newNickname !== this.currentNick) {
        this.client.nick(newNickname);
    }
  }
  
  public sendRaw(command: string): void {
    if (this.client && this.client.connected) {
        this.client.raw(command);
    }
  }
}