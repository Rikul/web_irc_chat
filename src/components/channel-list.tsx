
"use client";

import type { Channel } from "@/lib/types";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Hash, X, User } from "lucide-react"; // User icon for PMs

interface ChannelListProps {
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onLeaveChannel: (channelId: string) => void;
}

export function ChannelList({
  channels,
  activeChannelId,
  onSelectChannel,
  onLeaveChannel,
}: ChannelListProps) {
  if (channels.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No channels or conversations.
      </div>
    );
  }

  return (
    <SidebarMenu>
      {channels.map((channel) => (
        <SidebarMenuItem key={channel.id}>
          <SidebarMenuButton
            onClick={() => onSelectChannel(channel.id)}
            isActive={channel.id === activeChannelId}
            className="justify-between w-full"
            tooltip={{ children: `${channel.name}${channel.topic?.text ? ` - ${channel.topic.text}` : ''}`, side: 'right' }}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {channel.name.startsWith("#") ? <Hash className="h-4 w-4" /> : <User className="h-4 w-4" />}
              <span className="truncate">{channel.name}</span>
            </div>
          </SidebarMenuButton>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover/menu-item:opacity-100 transition-opacity group-data-[collapsible=icon]:hidden"
            onClick={(e) => {
              e.stopPropagation();
              onLeaveChannel(channel.id);
            }}
            aria-label={`Leave ${channel.name.startsWith("#") ? 'channel' : 'conversation with'} ${channel.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
