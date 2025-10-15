"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator
} from "@/components/ui/sidebar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectDialog } from "./connect-dialog";
import { SettingsDialog, type SettingsFormValues } from "./settings-dialog";
import { ServerLogDialog } from "./server-log-dialog";
import { ChannelList } from "./channel-list";
import { AvailableChannelList } from "./available-channel-list";
import { UserList } from "./user-list";
import { MessageArea } from "./message-area";
import { MessageInput } from "./message-input";
import type { ServerConnection, Channel, User, Message, AvailableChannelInfo } from "@/lib/types";
import { IrcService, type IrcServiceEventCallbacks } from "@/services/irc-service";
import { useToast } from "@/hooks/use-toast";
import { Server as ServerIcon, Hash, Users, MessageCircle, LogIn, LogOut, PlusCircle, Settings, Bot, List, Terminal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function IrcClient() {
  const [activeServer, setActiveServer] = useState<ServerConnection | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [availableChannels, setAvailableChannels] = useState<AvailableChannelInfo[]>([]);
  const [serverLogMessages, setServerLogMessages] = useState<Message[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null); // serverId#channelName or serverId for server logs
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isServerLogDialogOpen, setIsServerLogDialogOpen] = useState(false);
  const [joinChannelName, setJoinChannelName] = useState("");
  const [ircService, setIrcService] = useState<IrcService | null>(null);
  const [isListingChannels, setIsListingChannels] = useState(false);

  const { toast } = useToast();
  const callbacksRef = useRef<IrcServiceEventCallbacks | null>(null); // Ref to hold the latest callbacks

  const currentTarget = useMemo(() => {
    if (!activeServer || !activeChannelId) return null;
    if (activeChannelId === activeServer.id) { // Server log "channel"
      return {
        id: activeServer.id,
        name: activeServer.host, // Display server host as name
        messages: serverLogMessages, // Pass serverLogMessages for the dialog
        users: [],
        topic: { text: "Server messages and logs" },
        type: 'server'
      };
    }
    const channel = channels.find(c => c.id === activeChannelId);
    if (channel) {
        return { ...channel, type: 'channel' }; // Add type for clarity
    }
    return null; // Explicitly return null if no target found
  }, [activeServer, activeChannelId, channels, serverLogMessages]);


  // Define the actual callback implementations
  const serviceCallbacksImpl: IrcServiceEventCallbacks = useMemo(() => ({
    onConnect: (serverId) => {
      setActiveServer(prev => prev && prev.id === serverId ? { ...prev, isConnected: true, isConnecting: false } : prev);
      setServerLogMessages(prev => [...prev, { id: crypto.randomUUID(), timestamp: Date.now(), content: `Connected to ${serverId}.`, type: 'info', channelId: serverId, target: serverId }]);
      toast({ title: "Connected!", description: `Successfully connected to ${serverId}.` });
      // Access ircService via state here, as it will be set by the time this callback runs
      ircService?.listChannels();
    },
    onDisconnect: (serverId, reason) => {
      setActiveServer(prev => prev && prev.id === serverId ? { ...prev, isConnected: false, isConnecting: false } : null);
      setServerLogMessages(prev => [...prev, { id: crypto.randomUUID(), timestamp: Date.now(), content: `Disconnected from ${serverId}. Reason: ${reason || 'Unknown'}`, type: 'info', channelId: serverId, target: serverId }]);
      setChannels([]);
      setAvailableChannels([]);
      setActiveChannelId(null);
      setIsServerLogDialogOpen(false); // Close server log dialog on disconnect
      toast({ title: "Disconnected", description: `Disconnected from ${serverId}. ${reason}` });
    },
    onError: (serverId, error) => {
      const errorMsgContent = `Error on ${serverId}: ${error.type} - ${error.message}`;
      setServerLogMessages(prev => [...prev, { id: crypto.randomUUID(), timestamp: Date.now(), content: errorMsgContent, type: 'error', channelId: serverId, target: serverId }]);
      toast({ title: "IRC Error", description: errorMsgContent, variant: "destructive" });
       if (error.type === 'ErrorLookingUpHost' || error.type === 'SocketError' || error.type === 'ConnectionRefused') {
         setActiveServer(prev => prev && prev.id === serverId ? { ...prev, isConnected: false, isConnecting: false } : null);
      }
    },
    onServerMessage: (serverId, message) => {
      setServerLogMessages(prev => [...prev, message]);
    },
    onChannelMessage: (serverId, message) => {
       const currentActiveServer = activeServer; // Capture activeServer from outer scope

       setChannels(prevChannels => {
            let channelExists = false;
            const updatedChannels = prevChannels.map(ch => {
                if (ch.id === message.channelId) {
                    channelExists = true;
                    return { ...ch, messages: [...ch.messages, message] };
                }
                return ch;
            });

            // Handle creating PM "channels" if they don't exist
            if (!channelExists && !message.target.startsWith('#') && currentActiveServer && message.nickname) {
                 const pmUserNick = message.isSelf ? message.target : message.nickname;
                 const newPmChannel: Channel = {
                     id: message.channelId, // Use the channelId from the message
                     serverId: serverId,
                     name: pmUserNick,
                     users: [
                         {id: currentActiveServer.nickname, nickname: currentActiveServer.nickname},
                         {id: pmUserNick, nickname: pmUserNick}
                     ],
                     messages: [message],
                     topic: {text: `Private messages with ${pmUserNick}`}
                 };
                 return [...updatedChannels, newPmChannel];
            }
            return updatedChannels;
       });
    },
    onUserJoinedChannel: (serverId, channelName, nick, user) => {
      const channelId = `${serverId}${channelName}`;
      setChannels(prev => prev.map(ch => {
        if (ch.id === channelId) {
          const userExists = ch.users.some(u => u.nickname.toLowerCase() === nick.toLowerCase());
          return {
            ...ch,
            users: userExists ? ch.users : [...ch.users, user],
            messages: [...ch.messages, { id: crypto.randomUUID(), timestamp: Date.now(), nickname: nick, type: 'join', content: '', channelId: ch.id, target: channelName }]
          };
        }
        return ch;
      }));
    },
    onUserPartedChannel: (serverId, channelName, nick, reason) => {
      const channelId = `${serverId}${channelName}`;
      setChannels(prev => prev.map(ch =>
        ch.id === channelId ? {
          ...ch,
          users: ch.users.filter(u => u.nickname.toLowerCase() !== nick.toLowerCase()),
          messages: [...ch.messages, { id: crypto.randomUUID(), timestamp: Date.now(), nickname: nick, content: reason || '', type: 'part', channelId: ch.id, target: channelName }]
        } : ch
      ));
    },
    onUserQuit: (serverId, nick, reason, quitchannels) => {
      setChannels(prev => prev.map(ch =>
        quitchannels.includes(ch.name.toLowerCase()) ? {
          ...ch,
          users: ch.users.filter(u => u.nickname.toLowerCase() !== nick.toLowerCase()),
          messages: [...ch.messages, { id: crypto.randomUUID(), timestamp: Date.now(), nickname: nick, content: reason || '', type: 'quit', channelId: ch.id, target: ch.name }]
        } : ch
      ));
    },
    onNickChange: (serverId, oldNick, newNick, nickChannels) => {
      const currentActiveServer = activeServer; // Capture state
      setChannels(prev => prev.map(ch => {
        const isUserInChannel = ch.users.some(u => u.nickname.toLowerCase() === oldNick.toLowerCase());
        if (isUserInChannel || nickChannels.includes(ch.name.toLowerCase())) {
          return {
            ...ch,
            users: ch.users.map(u => u.nickname.toLowerCase() === oldNick.toLowerCase() ? { ...u, nickname: newNick, id: newNick } : u),
            messages: [...ch.messages, { id: crypto.randomUUID(), timestamp: Date.now(), oldNickname: oldNick, nickname: newNick, type: 'nick', content: '', channelId: ch.id, target: ch.name }]
          };
        }
        return ch;
      }));
      if (currentActiveServer && currentActiveServer.nickname.toLowerCase() === oldNick.toLowerCase()) {
        setActiveServer(prev => prev ? { ...prev, nickname: newNick } : null);
      }
    },
    onTopicChange: (serverId, channelName, topic, nick) => {
      const channelId = `${serverId}${channelName}`;
      setChannels(prev => prev.map(ch =>
        ch.id === channelId ? { ...ch, topic: { text: topic, setter: nick, timestamp: Date.now() } } : ch
      ));
      toast({ title: `Topic changed in ${channelName}`, description: topic });
    },
    onChannelUserList: (serverId, channelName, users) => {
      const channelId = `${serverId}${channelName}`;
      setChannels(prev => prev.map(ch =>
        ch.id === channelId ? { ...ch, users } : ch
      ));
    },
    onAvailableChannelsStart: (serverId) => {
      setAvailableChannels([]);
      setIsListingChannels(true);
    },
    onAvailableChannelItem: (serverId, channel) => {
      setAvailableChannels(prev => [...prev, channel]);
    },
    onAvailableChannelsEnd: (serverId) => {
      setIsListingChannels(false);
      setAvailableChannels(prev => [...prev].sort((a, b) => {
        if (a.userCount !== undefined && b.userCount !== undefined) {
          if (b.userCount !== a.userCount) {
            return b.userCount - a.userCount;
          }
        } else if (a.userCount !== undefined) {
          return -1;
        } else if (b.userCount !== undefined) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      }));
    },
    onModeChange: (serverId, target, nick, modes, params) => {
        const channelId = target.startsWith('#') ? `${serverId}${target}` : serverId;
        const modeMsgContent = `Mode change: ${target} [${modes}${params.length > 0 ? ' ' + params.join(' ') : ''}] by ${nick}`;
        const message: Message = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            nickname: nick,
            content: modeMsgContent,
            type: 'mode',
            channelId: channelId,
            target: target,
            modeParams: params
        };
        if (target.startsWith('#')) {
             setChannels(prev => prev.map(ch => ch.id === channelId ? {...ch, messages: [...ch.messages, message]} : ch));
             // Consider refreshing NAMES if mode change affects user list presentation (e.g., +o)
             // if (ircService && modes.includes('o') || modes.includes('v')) { // Example condition
             //    ircService.sendRaw(`NAMES ${target}`);
             // }
        } else {
             setServerLogMessages(prev => [...prev, message]);
        }
    },
    onKick: (serverId, channel, nick, by, reason) => {
        const channelId = `${serverId}${channel}`;
        const currentActiveServer = activeServer; // Capture state
        const currentActiveChannelId = activeChannelId; // Capture state

        const kickMessage: Message = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            nickname: by,
            kicked: nick,
            kickReason: reason,
            content: `${nick} was kicked from ${channel} by ${by} (${reason || 'No reason'})`,
            type: 'kick',
            channelId: channelId,
            target: channel,
        };
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId) {
                return {
                    ...ch,
                    users: ch.users.filter(u => u.nickname.toLowerCase() !== nick.toLowerCase()),
                    messages: [...ch.messages, kickMessage]
                };
            }
            return ch;
        }));
        if (nick.toLowerCase() === currentActiveServer?.nickname.toLowerCase()) {
            toast({ title: `Kicked from ${channel}`, description: `By ${by}: ${reason || 'No reason'}`, variant: 'destructive' });
             if (currentActiveChannelId === channelId) {
                setActiveChannelId(currentActiveServer?.id || null); // Revert to server view
                setIsServerLogDialogOpen(true); // Explicitly open server log if active channel kicked from
            }
        }
    }
  // --- Add other callbacks here, accessing state via outer scope (e.g., activeServer, activeChannelId) ---
  // --- and calling setters (e.g., setChannels, setActiveServer) ---
  }), [toast, activeServer, activeChannelId, ircService]); // Re-evaluate if state dependencies change

  // Update the ref whenever the implementation changes
  useEffect(() => {
    callbacksRef.current = serviceCallbacksImpl;
  }, [serviceCallbacksImpl]);

  // Create the service instance ONCE on mount
  useEffect(() => {
    // Create delegating callbacks that always read from the ref
    const delegatingCallbacks: IrcServiceEventCallbacks = {
      onConnect: (...args) => callbacksRef.current?.onConnect(...args),
      onDisconnect: (...args) => callbacksRef.current?.onDisconnect(...args),
      onError: (...args) => callbacksRef.current?.onError(...args),
      onServerMessage: (...args) => callbacksRef.current?.onServerMessage(...args),
      onChannelMessage: (...args) => callbacksRef.current?.onChannelMessage(...args),
      onUserJoinedChannel: (...args) => callbacksRef.current?.onUserJoinedChannel(...args),
      onUserPartedChannel: (...args) => callbacksRef.current?.onUserPartedChannel(...args),
      onUserQuit: (...args) => callbacksRef.current?.onUserQuit(...args),
      onNickChange: (...args) => callbacksRef.current?.onNickChange(...args),
      onTopicChange: (...args) => callbacksRef.current?.onTopicChange(...args),
      onChannelUserList: (...args) => callbacksRef.current?.onChannelUserList(...args),
      onAvailableChannelsStart: (...args) => callbacksRef.current?.onAvailableChannelsStart(...args),
      onAvailableChannelItem: (...args) => callbacksRef.current?.onAvailableChannelItem(...args),
      onAvailableChannelsEnd: (...args) => callbacksRef.current?.onAvailableChannelsEnd(...args),
      onModeChange: (...args) => callbacksRef.current?.onModeChange(...args),
      onKick: (...args) => callbacksRef.current?.onKick(...args),
    };

    const service = new IrcService(delegatingCallbacks);
    setIrcService(service); // Set the service instance in state

    return () => {
      service.disconnect();
      callbacksRef.current = null; // Clean up ref on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Empty dependency array ensures this runs only once on mount

  const handleConnect = useCallback((details: Omit<ServerConnection, "id" | "isConnected" | "isConnecting">) => {
    if (!ircService) {
        console.error("IRC Service not initialized yet.");
        toast({ title: "Error", description: "IRC Service not ready.", variant: "destructive" });
        return;
    }
    const serverId = `${details.host}:${details.port}`;
    const serverDetailsWithId = { ...details, id: serverId };

    setActiveServer({ ...serverDetailsWithId, isConnected: false, isConnecting: true });
    setChannels([]);
    setAvailableChannels([]);
    setServerLogMessages([{ id: crypto.randomUUID(), timestamp: Date.now(), content: `Attempting to connect to ${details.host}...`, type: 'info', channelId: serverId, target: serverId }]);
    setActiveChannelId(serverId);
    setIsServerLogDialogOpen(true); // Open server log dialog on new connection attempt

    ircService.connect(serverDetailsWithId);
  }, [ircService, toast]); // Depend on ircService state

  const handleDisconnect = useCallback(() => {
    if (activeServer && ircService) {
      ircService.disconnect();
    }
  }, [activeServer, ircService]); // Depend on state

  const executeJoinChannel = useCallback((channelNameToJoin: string) => {
    if (!activeServer || !activeServer.isConnected || !channelNameToJoin.trim() || !ircService) return;

    const properChannelName = channelNameToJoin.startsWith("#") ? channelNameToJoin.trim() : `#${channelNameToJoin.trim()}`;
    const channelId = `${activeServer.id}${properChannelName.toLowerCase()}`;

    if (channels.find(c => c.id === channelId)) {
      toast({
        title: "Already joined",
        description: `You are already in channel ${properChannelName}.`,
        variant: "default"
      });
      setActiveChannelId(channelId);
      return;
    }

    const newChannelPlaceholder: Channel = {
        id: channelId,
        serverId: activeServer.id,
        name: properChannelName,
        users: [{id: activeServer.nickname, nickname: activeServer.nickname}],
        messages: [{ id: crypto.randomUUID(), timestamp: Date.now(), type: 'info', content: `Joining ${properChannelName}...`, channelId: channelId, target: properChannelName }],
        topic: {text: `Joining ${properChannelName}...`}
    };
    setChannels(prev => [...prev, newChannelPlaceholder]);
    setActiveChannelId(channelId);


    ircService.joinChannel(properChannelName);
    setJoinChannelName("");
    toast({
      title: "Joining Channel",
      description: `Attempting to join ${properChannelName}.`,
    });
  }, [activeServer, channels, ircService, toast]); // Depend on state

  const handleManualJoinChannel = useCallback(() => {
    executeJoinChannel(joinChannelName);
  }, [executeJoinChannel, joinChannelName]); // Depend on other callback + state

  const handleJoinFromAvailable = useCallback((channelName: string) => {
    executeJoinChannel(channelName);
  }, [executeJoinChannel]); // Depend on other callback

  const handleLeaveChannel = useCallback((channelIdToLeave: string) => {
    if (!ircService || !activeServer) return;
    const channel = channels.find(c => c.id === channelIdToLeave);
    if (channel) {
      ircService.partChannel(channel.name);
      setChannels(prev => prev.filter(c => c.id !== channelIdToLeave));
      if (activeChannelId === channelIdToLeave) {
        setActiveChannelId(activeServer.id);
        setIsServerLogDialogOpen(true); // Show server log dialog if active channel was left
      }
      toast({
        title: "Channel Left",
        description: `You have left ${channel.name}.`,
      });
    }
  }, [ircService, activeServer, channels, activeChannelId, toast]); // Depend on state

  const handleSendMessage = useCallback((text: string) => {
    if (!currentTarget || !activeServer || !activeServer.isConnected || !ircService) return;
     // Allow sending to server via /quote or /raw ? For now, block sending from server view.
    if (currentTarget.type === 'server' || !currentTarget.name) return;

    ircService.sendMessage(currentTarget.name, text);

    // Add self message immediately for responsiveness
    if (currentTarget.id && activeServer.nickname && !text.startsWith('/')) { // Basic check to avoid adding command text as self message
        const selfMessage: Message = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            nickname: activeServer.nickname,
            content: text.startsWith('/me ') ? text.substring(4) : text,
            type: text.startsWith('/me ') ? 'action' : 'message',
            channelId: currentTarget.id,
            target: currentTarget.name,
            isSelf: true,
        };
        setChannels(prev => prev.map(ch =>
        ch.id === currentTarget.id
            ? { ...ch, messages: [...ch.messages, selfMessage] }
            : ch
        ));
    }
  }, [currentTarget, activeServer, ircService]); // Depend on state

  const handleSaveSettings = useCallback((newSettings: SettingsFormValues) => {
    if (activeServer && ircService) {
      const oldNickname = activeServer.nickname;
      if (newSettings.nickname !== oldNickname) {
        ircService.changeNick(newSettings.nickname);
        // Nick change confirmation will come via 'nick' event handler, which updates activeServer state
      }
      // Update non-nick settings immediately if needed, though they aren't sent to server here
       setActiveServer(prev => prev ? ({
         ...prev,
         // Only update nickname if the changeNick command wasn't sent
         nickname: newSettings.nickname === oldNickname ? prev.nickname : newSettings.nickname,
         realName: newSettings.realName,
         email: newSettings.email,
       }) : null);
    }
  }, [activeServer, ircService]); // Depend on state

  const handleSelectChannel = useCallback((targetId: string) => {
    setActiveChannelId(targetId);
    // Request NAMES if selecting a channel and user list seems incomplete (e.g., only self)
    if (targetId.includes('#') && ircService && activeServer?.isConnected) {
        const channel = channels.find(c => c.id === targetId);
        if (channel && channel.users.length <= 1) {
             ircService.sendRaw(`NAMES ${channel.name}`);
        }
    }
  }, [ircService, activeServer, channels]); // Depend on state

  const handleServerLogButtonClick = useCallback(() => {
    if (activeServer) {
      handleSelectChannel(activeServer.id); // Set context
      setIsServerLogDialogOpen(true);      // Open dialog
    }
  }, [activeServer, handleSelectChannel]); // Depend on state


  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-screen max-h-screen max-w-screen overflow-hidden bg-background">
        <Sidebar collapsible="icon" className="border-r shadow-md">
          <SidebarHeader className="p-3 items-center">
            <div className="flex items-center gap-2 w-full">
              <MessageCircle className="h-7 w-7 text-primary" />
              <h1 className="text-xl font-semibold group-data-[collapsible=icon]:hidden">ViteChat</h1>
            </div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent className="p-0 overflow-auto
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-gray-100
              [&::-webkit-scrollbar-thumb]:bg-gray-300
              dark:[&::-webkit-scrollbar-track]:bg-neutral-700
              dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
            {activeServer ? (
              <>
                <SidebarGroup className="p-2">
                  <SidebarGroupLabel className="flex items-center gap-2 mb-1 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center">
                      {activeServer.host}
                  </SidebarGroupLabel>
                   <div className="flex items-center gap-2 w-full mb-2 px-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
                        <Avatar className="h-6 w-6 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                        <AvatarImage src={`https://picsum.photos/seed/${activeServer.nickname}/40/40`} data-ai-hint="avatar person" />
                        <AvatarFallback>{activeServer.nickname.substring(0,1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate group-data-[collapsible=icon]:hidden">{activeServer.nickname}</span>
                        <div className="flex-grow group-data-[collapsible=icon]:hidden" />
                         <Button variant="ghost" size="icon"
                            onClick={() => { if (activeServer.isConnected || activeServer.isConnecting) handleDisconnect(); else setIsConnectDialogOpen(true);}}
                            className="h-7 w-7 group-data-[collapsible=icon]:mt-1"
                            tooltip={{ children: activeServer.isConnected ? 'Disconnect' : (activeServer.isConnecting ? 'Connecting...' : 'Connect'), side: 'right' }}
                            disabled={activeServer.isConnecting}
                        >
                        {activeServer.isConnected ? <LogOut className="h-4 w-4" /> : (activeServer.isConnecting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div> : <LogIn className="h-4 w-4" />)}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSettingsDialogOpen(true)} tooltip={{children: 'Settings', side: 'right'}}>
                          <Settings className="h-4 w-4" />
                      </Button>
                   </div>

                  <div className="flex gap-1 mb-2 px-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
                    <Input
                      type="text"
                      placeholder="#channel"
                      value={joinChannelName}
                      onChange={(e) => setJoinChannelName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleManualJoinChannel()}
                      className="h-8 text-sm group-data-[collapsible=icon]:hidden"
                      aria-label="Join channel input"
                      disabled={!activeServer.isConnected}
                    />
                    <Button onClick={handleManualJoinChannel} size="sm" variant="outline" className="h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0" disabled={!activeServer.isConnected || !joinChannelName.trim()}>
                      <PlusCircle className="h-4 w-4 group-data-[collapsible=icon]:m-auto" />
                      <span className="ml-1 group-data-[collapsible=icon]:hidden">Join</span>
                    </Button>
                  </div>
                </SidebarGroup>

                <SidebarSeparator />
                 <div className="px-2">
                    <Button
                        variant={activeChannelId === activeServer.id ? "secondary" : "ghost"}
                        className="w-full justify-start h-8 text-sm mb-1 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
                        onClick={handleServerLogButtonClick}
                        tooltip={{children: 'Open Server Log Window', side: 'right'}}
                    >
                        <Terminal className="h-4 w-4" />
                        <span className="ml-2 group-data-[collapsible=icon]:hidden">Server Log</span>
                    </Button>
                </div>


                <Accordion type="multiple" defaultValue={["joined-channels", "available-channels", "private-messages"]} className="w-full px-2 group-data-[collapsible=icon]:px-0">
                  <AccordionItem value="joined-channels" className="border-none">
                    <AccordionTrigger className="py-2 text-sm hover:no-underline group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:px-1 [&_svg.lucide-chevron-down]:group-data-[collapsible=icon]:hidden">
                      <div className="flex items-center gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground">
                        <Hash className="h-4 w-4" />
                        <span className="font-medium group-data-[collapsible=icon]:hidden">Joined Channels</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1 group-data-[collapsible=icon]:hidden">
                      <ChannelList
                        channels={channels.filter(c => c.name.startsWith('#'))}
                        activeChannelId={activeChannelId}
                        onSelectChannel={handleSelectChannel}
                        onLeaveChannel={handleLeaveChannel}
                      />
                    </AccordionContent>
                  </AccordionItem>
                   <AccordionItem value="private-messages" className="border-none">
                    <AccordionTrigger className="py-2 text-sm hover:no-underline group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:px-1 [&_svg.lucide-chevron-down]:group-data-[collapsible=icon]:hidden">
                      <div className="flex items-center gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground">
                        <Users className="h-4 w-4" />
                        <span className="font-medium group-data-[collapsible=icon]:hidden">Private Messages</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1 group-data-[collapsible=icon]:hidden">
                      <ChannelList
                        channels={channels.filter(c => !c.name.startsWith('#'))}
                        activeChannelId={activeChannelId}
                        onSelectChannel={handleSelectChannel}
                        onLeaveChannel={handleLeaveChannel}
                      />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="available-channels" className="border-none">
                    <AccordionTrigger className="py-2 text-sm hover:no-underline group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:px-1 [&_svg.lucide-chevron-down]:group-data-[collapsible=icon]:hidden">
                       <div className="flex items-center gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground">
                        <List className="h-4 w-4" />
                        <span className="font-medium group-data-[collapsible=icon]:hidden">Available Channels</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1 group-data-[collapsible=icon]:hidden">
                      <AvailableChannelList
                        channels={availableChannels}
                        onJoinChannel={handleJoinFromAvailable}
                        isLoading={isListingChannels}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            ) : (
              <div className="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <Button onClick={() => setIsConnectDialogOpen(true)} className="w-full group-data-[collapsible=icon]:w-auto">
                  <LogIn className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Connect</span>
                </Button>
              </div>
            )}
          </SidebarContent>

        </Sidebar>

        <SidebarInset className="flex flex-col max-h-screen min-w-0 flex-1">
          {activeServer && currentTarget ? (
            <>
              <header className="p-3 border-b flex items-center justify-between bg-card shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                   <div className="md:hidden">
                     <SidebarTrigger />
                   </div>
                  {currentTarget.type !== 'server' ? <Hash className="h-5 w-5 text-muted-foreground" /> : <Terminal className="h-5 w-5 text-muted-foreground" />}
                  <div>
                    <h2 className="text-lg font-semibold">{currentTarget.name}</h2>
                    {currentTarget.topic?.text && <p className="text-xs text-muted-foreground truncate max-w-xs md:max-w-md lg:max-w-lg">{currentTarget.topic.text}</p>}
                  </div>
                </div>
              </header>
              <main className="flex flex-1 overflow-hidden p-2 md:p-3 gap-2 md:gap-3 bg-secondary/50">
                <div className="flex-grow flex flex-col overflow-hidden min-w-0">
                   <MessageArea
                     messages={currentTarget.type !== 'server' ? currentTarget.messages : []} // Pass empty array if server view
                     channelName={currentTarget.name}
                     isServerLogView={currentTarget.type === 'server'}
                     onOpenServerLogDialog={() => setIsServerLogDialogOpen(true)}
                   />
                </div>
                {currentTarget.type !== 'server' && currentTarget.users && (
                  <aside className="w-48 md:w-56 lg:w-64 hidden sm:block flex-shrink-0 overflow-y-auto">
                    <UserList users={currentTarget.users} />
                  </aside>
                )}
              </main>
              <MessageInput onSendMessage={handleSendMessage} disabled={!activeServer.isConnected || currentTarget.type === 'server'} />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-secondary/30">
               <div className="md:hidden mb-4">
                <SidebarTrigger />
               </div>
              <Bot className="h-16 w-16 text-primary mb-4" data-ai-hint="robot chat" />
              <h2 className="text-2xl font-semibold mb-2">
                {activeServer ? "Select or Join a Channel" : "Welcome to ViteChat!"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {activeServer
                  ? "Choose a channel, view server logs, or join a new channel."
                  : "Connect to an IRC server to get started."}
              </p>
              {!activeServer && (
                <Button onClick={() => setIsConnectDialogOpen(true)}>
                  <LogIn className="mr-2 h-4 w-4" /> Connect to Server
                </Button>
              )}
               {activeServer && activeServer.isConnecting && (
                 <div className="flex items-center text-muted-foreground">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                    Connecting to {activeServer.host}...
                 </div>
               )}
               {activeServer && !activeServer.isConnected && !activeServer.isConnecting && (
                 <Button onClick={() => handleConnect({host: activeServer.host, port: activeServer.port, nickname: activeServer.nickname, realName: activeServer.realName, password: activeServer.password, email: activeServer.email })}>
                    <LogIn className="mr-2 h-4 w-4" /> Reconnect to {activeServer.host}
                 </Button>
               )}

            </div>
          )}
        </SidebarInset>
      </div>
      <ConnectDialog
        isOpen={isConnectDialogOpen}
        onOpenChange={setIsConnectDialogOpen}
        onConnect={handleConnect}
      />
      {activeServer && (
        <SettingsDialog
          isOpen={isSettingsDialogOpen}
          onOpenChange={setIsSettingsDialogOpen}
          currentSettings={{
            nickname: activeServer.nickname,
            realName: activeServer.realName,
            email: activeServer.email,
          }}
          onSave={handleSaveSettings}
        />
      )}
      {activeServer && (
        <ServerLogDialog
          isOpen={isServerLogDialogOpen}
          onOpenChange={setIsServerLogDialogOpen}
          messages={serverLogMessages}
          serverName={activeServer.host}
        />
      )}
    </SidebarProvider>
  );
}
