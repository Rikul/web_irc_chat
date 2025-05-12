
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

    this.client.connect({
      host: details.host,
      port: details.port,
      nick: details.nickname,
      username: details.nickname, // Usually nickname or a generic username
      gecos: details.realName || 'ViteChat User',
      password: details.password,
      auto_reconnect: false, // We'll manage reconnect logic if needed
      auto_reconnect_max_wait: 30000,
      auto_reconnect_max_retries: 3,
      version: 'ViteChat 0.5.0 - https://vitechat.dev', // Example version
      encoding: 'utf8', // Ensure UTF-8
      tls: details.port === 6697 || details.port === 9999, // Common SSL ports
      rejectUnauthorized: false, // Set to true in production with valid certs
    });

    this.registerEvents();
  }

  public disconnect(reason: string = 'Client disconnected'): void {
    if (this.client) {
      this.client.quit(reason);
      // Events like 'close' or 'socket close' will trigger callback.onDisconnect
    }
    this.client = null;
    this.serverId = null;
    this.currentNick = null;
  }

  private registerEvents(): void {
    if (!this.client || !this.serverId) return;

    const serverId = this.serverId; // Capture serverId for closures

    this.client.on('registered', () => {
      this.callbacks.onConnect(serverId);
      // Request channel list automatically after connection
      this.listChannels(); 
    });

    this.client.on('close', (event) => {
      const reason = event && event.reason ? event.reason : 'Connection closed';
      this.callbacks.onDisconnect(serverId, reason);
      this.client = null; // Ensure client is nullified
    });
    
    this.client.on('socket close', () => {
        // Sometimes 'close' isn't emitted if the socket closes abruptly
        if (this.client) { // Check if disconnect hasn't been handled by 'close'
            this.callbacks.onDisconnect(serverId, 'Socket closed abruptly');
            this.client = null;
        }
    });

    this.client.on('error', (err) => {
      this.callbacks.onError(serverId, { type: err.type || 'UnknownError', message: err.message, ...err });
    });

    // Server messages (MOTD, notices from server, etc.)
    const handleServerNotice = (event: IRC.Event_Notice) => {
        if (!this.currentNick || event.target.toLowerCase() === this.currentNick.toLowerCase() || event.nick === serverId.split(':')[0] || !event.target.startsWith('#')) {
             this.callbacks.onServerMessage(serverId, {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                nickname: event.nick, // Server name or specific service
                content: event.message,
                type: 'notice',
                channelId: serverId, // Server-wide context
                target: event.target,
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
            // Filter out MOTD parts handled by 'motd' event & common numerics unless explicitly needed.
            // Numerics like 001-005 (welcome messages), 251-255 (server stats), 372, 375, 376 (MOTD)
            // are often handled by specific events or can be verbose.
            // We can choose to log specific numerics if needed.
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


    // Channel-specific events
    this.client.on('message', (event) => {
      if (event.target.startsWith('#')) { // Channel message
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
      } else { // Private message
         this.callbacks.onChannelMessage(serverId, { // Treat PMs as messages in a "channel" named after the user
          id: crypto.randomUUID(),
          timestamp: event.network_time || Date.now(),
          nickname: event.nick,
          content: event.message,
          type: 'message',
          channelId: `${serverId}${event.nick.toLowerCase()}`, // PM channel ID uses the other user's nick
          target: event.nick.toLowerCase(), // Target is the user who sent the PM
          isSelf: false, // PMs are from others
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
        } // PM actions can be handled similarly if needed
    });
    
    this.client.on('ctcp request', (event) => {
        if (event.command === 'VERSION') {
            this.client?.ctcpResponse(event.nick, 'VERSION', 'ViteChat 0.5.0 - A modern IRC client');
        } else if (event.command === 'PING') {
            this.client?.ctcpResponse(event.nick, 'PING', event.params);
        }
    });


    this.client.on('join', (event) => {
      const user: User = { id: event.nick, nickname: event.nick, username: event.ident, hostname: event.hostname };
      this.callbacks.onUserJoinedChannel(serverId, event.channel.toLowerCase(), event.nick, user);
      if (event.nick.toLowerCase() === this.currentNick?.toLowerCase()) {
        this.client?.names(event.channel); // Request user list for the channel we just joined
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
      if (event.nick.toLowerCase() === this.currentNick?.toLowerCase()) {
        this.currentNick = event.new_nick;
      }
      this.callbacks.onNickChange(serverId, event.nick, event.new_nick, event.channels.map(c => c.toLowerCase()));
    });

    this.client.on('topic', (event) => {
      this.callbacks.onTopicChange(serverId, event.channel.toLowerCase(), event.topic, event.nick);
    });

    this.client.on('userlist', (event) => { // Response to NAMES or automatic user list updates
      const users: User[] = event.users.map(u => ({
        id: u.nick,
        nickname: u.nick,
        username: u.ident,
        hostname: u.hostname,
        modes: u.modes || [],
        isOp: u.modes?.includes('@') || u.modes?.includes('o'),
        isVoice: u.modes?.includes('+') || u.modes?.includes('v'),
      }));
      this.callbacks.onChannelUserList(serverId, event.channel.toLowerCase(), users);
    });
     this.client.on('names', (event) => { // Response to NAMES command specifically
      const users: User[] = event.users.map(u => ({
        id: u.nick,
        nickname: u.nick,
        username: u.ident,
        hostname: u.hostname,
        modes: u.modes || [],
        isOp: u.modes?.includes('@') || u.modes?.includes('o'),
        isVoice: u.modes?.includes('+') || u.modes?.includes('v'),
      }));
      this.callbacks.onChannelUserList(serverId, event.channel.toLowerCase(), users);
    });


    // Channel list events
    this.client.on('channel list start', () => {
      this.callbacks.onAvailableChannelsStart(serverId);
    });

    this.client.on('channel list item', (event) => {
      this.callbacks.onAvailableChannelItem(serverId, {
        id: `${serverId}${event.channel.toLowerCase()}`,
        serverId: serverId,
        name: event.channel, // Keep original casing for display if desired, but use lowercase for ID
        userCount: event.users,
        topic: event.topic,
        modes: event.modes_string,
      });
    });

    this.client.on('channel list end', () => {
      this.callbacks.onAvailableChannelsEnd(serverId);
    });

    this.client.on('mode', (event) => {
        // event.target (channel or nick), event.nick (who set mode), event.modes (array of mode changes)
        // event.modes is like [{mode: '+o', param: 'UserNick'}, {mode: '-n'}]
        const modesString = event.modes.map(m => m.mode + (m.param ? ` ${m.param}` : '')).join(' ');
        const params = event.modes.map(m => m.param).filter(Boolean) as string[];
        this.callbacks.onModeChange(serverId, event.target.toLowerCase(), event.nick, modesString, params);
    });
  }

  // Public methods to interact with IRC server
  public joinChannel(channelName: string): void {
    if (this.client && channelName) {
        const properChannelName = channelName.startsWith('#') ? channelName : `#${channelName}`;
        this.client.join(properChannelName);
    }
  }

  public partChannel(channelName: string, reason?: string): void {
    this.client?.part(channelName, reason || 'Leaving channel');
  }

  public sendMessage(target: string, message: string): void {
    if (message.startsWith('/me ')) {
        this.client?.action(target, message.substring(4));
    } else {
        this.client?.privmsg(target, message);
    }
  }

  public listChannels(): void {
    this.client?.list();
  }

  public changeNick(newNickname: string): void {
    if (this.client && newNickname && newNickname !== this.currentNick) {
        this.client.nick(newNickname);
    }
  }
  
  public sendRaw(command: string): void {
    this.client?.raw(command);
  }
}
