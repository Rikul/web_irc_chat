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
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectDialog } from "./connect-dialog";
import { ChannelList } from "./channel-list";
import { UserList } from "./user-list";
import { MessageArea } from "./message-area";
import { MessageInput } from "./message-input";
import type { ServerConnection, Channel, User, Message } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Server as ServerIcon, Hash, Users, MessageCircle, LogIn, LogOut, PlusCircle, Settings, Bot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


// Mock data and functions
const createMockUser = (nickname: string): User => ({ id: nickname, nickname });
const createMockMessage = (
  channelId: string,
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
  channelId,
  isSelf
});

export default function IrcClient() {
  const [activeServer, setActiveServer] = useState<ServerConnection | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
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
      isConnected: true, // Simulate successful connection
    };
    setActiveServer(newServer);
    setChannels([]); // Reset channels for new server
    setActiveChannelId(null);
    toast({
      title: "Connected!",
      description: `Successfully connected to ${newServer.host}.`,
    });

    // Simulate a welcome message
    const welcomeChannelId = `${serverId}#status`;
    const welcomeChannel: Channel = {
      id: welcomeChannelId,
      serverId: serverId,
      name: "status",
      topic: `Status for ${newServer.host}`,
      users: [createMockUser(newServer.nickname)],
      messages: [
        createMockMessage(welcomeChannelId, `Welcome to ${newServer.host}! You are connected as ${newServer.nickname}.`, undefined, 'info')
      ],
    };
    setChannels([welcomeChannel]);
    setActiveChannelId(welcomeChannelId);
  }, [toast]);

  const handleDisconnect = () => {
    if (activeServer) {
      toast({
        title: "Disconnected",
        description: `Disconnected from ${activeServer.host}.`,
      });
      setActiveServer(null);
      setChannels([]);
      setActiveChannelId(null);
    }
  };

  const handleJoinChannel = () => {
    if (!activeServer || !joinChannelName.trim()) return;

    const channelName = joinChannelName.startsWith("#") ? joinChannelName.trim() : `#${joinChannelName.trim()}`;
    const channelId = `${activeServer.id}${channelName}`;

    if (channels.find(c => c.id === channelId)) {
      toast({
        title: "Already joined",
        description: `You are already in channel ${channelName}.`,
        variant: "destructive"
      });
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
      name: channelName,
      topic: `Topic for ${channelName} - Welcome!`,
      users: mockUsers,
      messages: [
        createMockMessage(channelId, `You have joined ${channelName}.`, undefined, 'join', true),
        createMockMessage(channelId, `Welcome to ${channelName}!`, "ChanServ", 'message'),
      ],
    };
    setChannels(prev => [...prev, newChannel]);
    setActiveChannelId(channelId);
    setJoinChannelName("");
    toast({
      title: "Channel Joined",
      description: `Successfully joined ${channelName}.`,
    });
  };

  const handleLeaveChannel = (channelId: string) => {
    setChannels(prev => prev.filter(c => c.id !== channelId));
    if (activeChannelId === channelId) {
      const statusChannel = channels.find(c => c.name === "status" && c.serverId === activeServer?.id);
      setActiveChannelId(statusChannel ? statusChannel.id : null);
    }
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      toast({
        title: "Channel Left",
        description: `You have left ${channel.name}.`,
      });
    }
  };

  const handleSendMessage = (text: string) => {
    if (!activeChannelId || !activeServer) return;

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
      if (randomNick === activeServer?.nickname) return; // Don't simulate self messages here

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
    }, 5000 + Math.random() * 5000); // Random interval between 5-10 seconds

    return () => clearInterval(intervalId);
  }, [activeChannelId, activeServer?.nickname, currentChannel]);


  // Simulate user join/part
  useEffect(() => {
    if (!activeChannelId || !currentChannel || currentChannel.name === "status") return;

    const userActivityInterval = setInterval(() => {
      const isJoin = Math.random() > 0.5;
      const potentialNicks = ["Guest123", "NewUser", "OldFriend"];
      const nick = potentialNicks[Math.floor(Math.random() * potentialNicks.length)];

      setChannels(prev => prev.map(c => {
        if (c.id === activeChannelId) {
          let newUsers = [...c.users];
          let activityMessage: Message;

          if (isJoin && !c.users.find(u => u.nickname === nick)) {
            newUsers.push(createMockUser(nick));
            activityMessage = createMockMessage(activeChannelId, "", nick, 'join');
          } else if (!isJoin && c.users.find(u => u.nickname === nick) && nick !== activeServer?.nickname) {
            newUsers = c.users.filter(u => u.nickname !== nick);
            activityMessage = createMockMessage(activeChannelId, "Leaving", nick, 'part');
          } else {
            return c; // No change
          }
          return { ...c, users: newUsers, messages: [...c.messages, activityMessage] };
        }
        return c;
      }));
    }, 15000 + Math.random() * 10000); // Random interval between 15-25 seconds

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
            <SidebarGroup className="p-2">
            {activeServer ? (
              <>
                <SidebarGroupLabel className="flex items-center gap-2 mb-1">
                  <ServerIcon className="h-4 w-4" /> {activeServer.host}
                </SidebarGroupLabel>
                <div className="flex gap-1 mb-2 px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                  <Input
                    type="text"
                    placeholder="#channel"
                    value={joinChannelName}
                    onChange={(e) => setJoinChannelName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinChannel()}
                    className="h-8 text-sm group-data-[collapsible=icon]:hidden"
                    aria-label="Join channel input"
                  />
                   <Button onClick={handleJoinChannel} size="sm" variant="outline" className="h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0">
                    <PlusCircle className="h-4 w-4 group-data-[collapsible=icon]:m-auto" />
                    <span className="ml-1 group-data-[collapsible=icon]:hidden">Join</span>
                  </Button>
                </div>
                <ChannelList
                  channels={channels}
                  activeChannelId={activeChannelId}
                  onSelectChannel={setActiveChannelId}
                  onLeaveChannel={handleLeaveChannel}
                />
              </>
            ) : (
              <div className="p-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                <Button onClick={() => setIsConnectDialogOpen(true)} className="w-full group-data-[collapsible=icon]:w-auto">
                  <LogIn className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Connect</span>
                </Button>
              </div>
            )}
            </SidebarGroup>
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
          {currentChannel ? (
            <>
              <header className="p-3 border-b flex items-center justify-between bg-card shadow-sm">
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-secondary/30">
               <div className="md:hidden mb-4">
                <SidebarTrigger />
               </div>
              <Bot className="h-16 w-16 text-primary mb-4" data-ai-hint="robot chat" />
              <h2 className="text-2xl font-semibold mb-2">Welcome to ViteChat!</h2>
              <p className="text-muted-foreground mb-6">
                {activeServer
                  ? "Select a channel to start chatting or join a new one."
                  : "Connect to an IRC server to get started."}
              </p>
              {!activeServer && (
                <Button onClick={() => setIsConnectDialogOpen(true)}>
                  <LogIn className="mr-2 h-4 w-4" /> Connect to Server
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
    </SidebarProvider>
  );
}

