
"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectDialog } from "./connect-dialog";
import { ChannelList } from "./channel-list";
import { AvailableChannelList } from "./available-channel-list";
import { UserList } from "./user-list";
import { MessageArea } from "./message-area";
import { MessageInput } from "./message-input";
import { ServerLogView } from "./server-log-view";
import type { ServerConnection, Channel, User, Message, AvailableChannelInfo } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Server as ServerIcon, Hash, Users, MessageCircle, LogIn, LogOut, PlusCircle, Settings, Bot, List } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Mock data and functions
const createMockUser = (nickname: string): User => ({ id: nickname, nickname });
const createMockMessage = (
  targetId: string, // Can be channelId or serverId for server messages
  content: string,
  nickname?: string,
  type: Message['type'] = 'message',
  isSelf?: boolean
): Message => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  nickname,
  content,
  type,
  channelId: targetId, 
  isSelf
});

export default function IrcClient() {
  const [activeServer, setActiveServer] = useState<ServerConnection | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [availableChannels, setAvailableChannels] = useState<AvailableChannelInfo[]>([]);
  const [serverLogMessages, setServerLogMessages] = useState<Message[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [joinChannelName, setJoinChannelName] = useState("");
  const { toast } = useToast();

  const currentChannel = channels.find(c => c.id === activeChannelId);

  const handleConnect = useCallback((details: Omit<ServerConnection, "id" | "isConnected">) => {
    const serverId = `${details.host}:${details.port}`;
    const newServer: ServerConnection = {
      ...details,
      id: serverId,
      isConnected: true,
    };
    setActiveServer(newServer);
    setChannels([]); 
    setActiveChannelId(null);
    
    const welcomeMsg = createMockMessage(serverId, `Welcome to ${newServer.host}! You are connected as ${newServer.nickname}.`, undefined, 'info');
    const motdMsg1 = createMockMessage(serverId, `MOTD: This is a mock server. Please behave.`, undefined, 'system');
    const motdMsg2 = createMockMessage(serverId, `MOTD: Type /join #channel_name in the input above the channel lists to join a channel by name.`, undefined, 'system');
    setServerLogMessages([welcomeMsg, motdMsg1, motdMsg2]);

    // Simulate fetching available channels
    const mockAvailableChannels: AvailableChannelInfo[] = [
      { serverId, name: "#general", topic: "General discussions", userCount: Math.floor(Math.random() * 100) + 20, id: `${serverId}#general` },
      { serverId, name: "#random", topic: "Anything goes", userCount: Math.floor(Math.random() * 50) + 10, id: `${serverId}#random` },
      { serverId, name: "#help", topic: "Get assistance here", userCount: Math.floor(Math.random() * 30) + 5, id: `${serverId}#help` },
      { serverId, name: "#news", topic: "Latest updates", userCount: Math.floor(Math.random() * 70) + 15, id: `${serverId}#news` },
    ];
    setAvailableChannels(mockAvailableChannels);

    toast({
      title: "Connected!",
      description: `Successfully connected to ${newServer.host}.`,
    });
  }, [toast]);

  const handleDisconnect = () => {
    if (activeServer) {
      toast({
        title: "Disconnected",
        description: `Disconnected from ${activeServer.host}.`,
      });
      setActiveServer(null);
      setChannels([]);
      setAvailableChannels([]);
      setServerLogMessages([]);
      setActiveChannelId(null);
    }
  };

  const executeJoinChannel = (channelNameToJoin: string) => {
    if (!activeServer || !channelNameToJoin.trim()) return;

    const properChannelName = channelNameToJoin.startsWith("#") ? channelNameToJoin.trim() : `#${channelNameToJoin.trim()}`;
    const channelId = `${activeServer.id}${properChannelName}`;

    if (channels.find(c => c.id === channelId)) {
      toast({
        title: "Already joined",
        description: `You are already in channel ${properChannelName}.`,
        variant: "destructive"
      });
      setActiveChannelId(channelId); // Switch to it if already joined
      return;
    }

    const mockUsers = [
      createMockUser(activeServer.nickname),
      createMockUser("Alice"),
      createMockUser("Bob"),
      createMockUser("ChanServ")
    ];

    const newChannel: Channel = {
      id: channelId,
      serverId: activeServer.id,
      name: properChannelName,
      topic: `Topic for ${properChannelName} - Welcome!`,
      users: mockUsers,
      messages: [
        createMockMessage(channelId, `You have joined ${properChannelName}.`, undefined, 'join', true),
        createMockMessage(channelId, `Welcome to ${properChannelName}!`, "ChanServ", 'message'),
      ],
    };
    setChannels(prev => [...prev, newChannel]);
    setActiveChannelId(channelId);
    setJoinChannelName(""); // Clear input for manual join
    toast({
      title: "Channel Joined",
      description: `Successfully joined ${properChannelName}.`,
    });
     // Optionally remove from available channels or mark as joined
    setAvailableChannels(prev => prev.filter(ch => ch.name !== properChannelName));
  };
  
  const handleManualJoinChannel = () => {
    executeJoinChannel(joinChannelName);
  }

  const handleJoinFromAvailable = (channelName: string) => {
    executeJoinChannel(channelName);
  }

  const handleLeaveChannel = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    setChannels(prev => prev.filter(c => c.id !== channelId));
    if (activeChannelId === channelId) {
      setActiveChannelId(null); // No default channel to switch to
    }
    if (channel && activeServer) {
      // Add back to available channels (if it was originally from a discoverable list)
      // For simplicity, let's assume it might have been. This part could be more sophisticated.
      if (!availableChannels.find(ac => ac.name === channel.name)) {
        setAvailableChannels(prev => [...prev, { 
          id: channel.id, 
          serverId: activeServer.id, 
          name: channel.name, 
          topic: channel.topic, 
          userCount: channel.users.length 
        }]);
      }
      toast({
        title: "Channel Left",
        description: `You have left ${channel.name}.`,
      });
    }
  };

  const handleSendMessage = (text: string) => {
    if (!activeChannelId || !activeServer || !currentChannel) return;
    // Do not send from "status" or server log conceptual channels
    if (currentChannel.name === "status" || currentChannel.id === activeServer.id) return;


    const newMessage = createMockMessage(activeChannelId, text, activeServer.nickname, 'message', true);
    setChannels(prev => prev.map(c => 
      c.id === activeChannelId 
        ? { ...c, messages: [...c.messages, newMessage] }
        : c
    ));
  };

  // Simulate incoming messages
  useEffect(() => {
    if (!activeChannelId || !currentChannel || currentChannel.name === "status") return;

    const intervalId = setInterval(() => {
      const mockNicknames = ["Alice", "Bob", "CharlieBot"];
      const randomNick = mockNicknames[Math.floor(Math.random() * mockNicknames.length)];
      if (randomNick === activeServer?.nickname) return; 

      const randomMessage = createMockMessage(
        activeChannelId,
        `This is a simulated message from ${randomNick}! Random number: ${Math.floor(Math.random() * 100)}`,
        randomNick,
        'message'
      );

      setChannels(prev => prev.map(c => 
        c.id === activeChannelId 
          ? { ...c, messages: [...c.messages, randomMessage] }
          : c
      ));
    }, 7000 + Math.random() * 8000); 

    return () => clearInterval(intervalId);
  }, [activeChannelId, activeServer?.nickname, currentChannel]);


  // Simulate user join/part
  useEffect(() => {
    if (!activeChannelId || !currentChannel || currentChannel.name === "status") return;

    const userActivityInterval = setInterval(() => {
      const isJoin = Math.random() > 0.5;
      const potentialNicks = ["Guest123", "NewUser", "OldFriend", "AnotherBot"];
      const nick = potentialNicks[Math.floor(Math.random() * potentialNicks.length)];

      setChannels(prev => prev.map(c => {
        if (c.id === activeChannelId) {
          let newUsers = [...c.users];
          let activityMessage: Message | null = null;

          if (isJoin && !c.users.find(u => u.nickname === nick)) {
            newUsers.push(createMockUser(nick));
            activityMessage = createMockMessage(activeChannelId, "", nick, 'join');
          } else if (!isJoin && c.users.find(u => u.nickname === nick) && nick !== activeServer?.nickname) {
            newUsers = c.users.filter(u => u.nickname !== nick);
            activityMessage = createMockMessage(activeChannelId, "Simulated network issue", nick, 'part');
          }
          
          if (activityMessage) {
            return { ...c, users: newUsers, messages: [...c.messages, activityMessage] };
          }
          return c; 
        }
        return c;
      }));
    }, 20000 + Math.random() * 15000); 

    return () => clearInterval(userActivityInterval);
  }, [activeChannelId, activeServer?.nickname, currentChannel]);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen max-h-screen overflow-hidden bg-background">
        <Sidebar collapsible="icon" className="border-r shadow-md">
          <SidebarHeader className="p-3 items-center">
            <div className="flex items-center gap-2 w-full">
              <MessageCircle className="h-7 w-7 text-primary" />
              <h1 className="text-xl font-semibold group-data-[collapsible=icon]:hidden">ViteChat</h1>
            </div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent className="p-0">
            {activeServer ? (
              <>
                <SidebarGroup className="p-2">
                  <SidebarGroupLabel className="flex items-center gap-2 mb-1">
                    <ServerIcon className="h-4 w-4" /> {activeServer.host}
                  </SidebarGroupLabel>
                  <div className="flex gap-1 mb-2 px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                    <Input
                      type="text"
                      placeholder="#channel"
                      value={joinChannelName}
                      onChange={(e) => setJoinChannelName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleManualJoinChannel()}
                      className="h-8 text-sm group-data-[collapsible=icon]:hidden"
                      aria-label="Join channel input"
                    />
                    <Button onClick={handleManualJoinChannel} size="sm" variant="outline" className="h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0">
                      <PlusCircle className="h-4 w-4 group-data-[collapsible=icon]:m-auto" />
                      <span className="ml-1 group-data-[collapsible=icon]:hidden">Join</span>
                    </Button>
                  </div>
                </SidebarGroup>
                <SidebarSeparator />
                <SidebarGroup className="p-2">
                  <SidebarGroupLabel className="flex items-center gap-2 mb-1">
                    <Hash className="h-4 w-4" /> Joined Channels
                  </SidebarGroupLabel>
                  <ChannelList
                    channels={channels.filter(c => c.name !== 'status')} // Exclude status channel from user-joinable list
                    activeChannelId={activeChannelId}
                    onSelectChannel={setActiveChannelId}
                    onLeaveChannel={handleLeaveChannel}
                  />
                </SidebarGroup>
                <SidebarSeparator />
                <SidebarGroup className="p-2">
                  <SidebarGroupLabel className="flex items-center gap-2 mb-1">
                     <List className="h-4 w-4" /> Available Channels
                  </SidebarGroupLabel>
                  <AvailableChannelList
                    channels={availableChannels}
                    onJoinChannel={handleJoinFromAvailable}
                  />
                </SidebarGroup>
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
          <SidebarSeparator />
          <SidebarFooter className="p-3 items-center">
            {activeServer && (
               <div className="flex items-center gap-2 w-full group-data-[collapsible=icon]:justify-center">
                 <Avatar className="h-8 w-8">
                   <AvatarImage src={`https://picsum.photos/seed/${activeServer.nickname}/40/40`} data-ai-hint="avatar person" />
                   <AvatarFallback>{activeServer.nickname.substring(0,1).toUpperCase()}</AvatarFallback>
                 </Avatar>
                <span className="font-medium truncate group-data-[collapsible=icon]:hidden">{activeServer.nickname}</span>
              </div>
            )}
             <Button variant="ghost" size="icon" onClick={() => { if (activeServer) handleDisconnect(); else setIsConnectDialogOpen(true);}} className="group-data-[collapsible=icon]:mx-auto"
                tooltip={{ children: activeServer ? 'Disconnect' : 'Connect', side: 'right' }}
             >
              {activeServer ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col max-h-screen">
          {activeServer && activeChannelId && currentChannel ? (
            <>
              <header className="p-3 border-b flex items-center justify-between bg-card shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                   <div className="md:hidden">
                     <SidebarTrigger />
                   </div>
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="text-lg font-semibold">{currentChannel.name}</h2>
                    {currentChannel.topic && <p className="text-xs text-muted-foreground truncate max-w-xs md:max-w-md lg:max-w-lg">{currentChannel.topic}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Channel Settings</span>
                </Button>
              </header>
              <main className="flex flex-1 overflow-hidden p-2 md:p-3 gap-2 md:gap-3 bg-secondary/50">
                <div className="flex-grow flex flex-col overflow-hidden min-w-0">
                   <MessageArea messages={currentChannel.messages} channelName={currentChannel.name} />
                </div>
                <aside className="w-48 md:w-56 lg:w-64 hidden sm:block flex-shrink-0 overflow-y-auto">
                  <UserList users={currentChannel.users} />
                </aside>
              </main>
              <MessageInput onSendMessage={handleSendMessage} disabled={!activeChannelId || currentChannel.name === "status"} />
               <div className="flex-shrink-0 border-t">
                <ServerLogView messages={serverLogMessages} />
              </div>
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
                  ? "Choose a channel from the 'Available Channels' list, or type a channel name to join."
                  : "Connect to an IRC server to get started."}
              </p>
              {!activeServer && (
                <Button onClick={() => setIsConnectDialogOpen(true)}>
                  <LogIn className="mr-2 h-4 w-4" /> Connect to Server
                </Button>
              )}
              {activeServer && (
                 <div className="w-full max-w-md mt-4">
                    <ServerLogView messages={serverLogMessages} />
                 </div>
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
    </SidebarProvider>
  );
}
