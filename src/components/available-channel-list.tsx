
"use client";

import type { AvailableChannelInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { List, PlusCircle, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface AvailableChannelListProps {
  channels: AvailableChannelInfo[];
  onJoinChannel: (channelName: string) => void;
  isLoading?: boolean;
}

export function AvailableChannelList({
  channels,
  onJoinChannel,
  isLoading = false,
}: AvailableChannelListProps) {
  if (isLoading) {
    return (
      <div className="p-2 text-sm text-muted-foreground">
        Loading available channels...
      </div>
    );
  }

  if (channels.length === 0 && !isLoading) {
    return (
      <div className="p-2 text-sm text-muted-foreground">
        No available channels listed or could not fetch list.
      </div>
    );
  }

  return (
    <ScrollArea className="h-48 group-data-[collapsible=icon]:hidden">
      <ul className="space-y-1 p-1">
        {channels.map((channel) => (
          <li
            key={channel.id}
            className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-sidebar-accent group"
          >
            <div className="flex-grow overflow-hidden">
              <div className="text-sm font-medium text-sidebar-foreground truncate group-hover:text-sidebar-accent-foreground">
                {channel.name}
              </div>
              {channel.topic && (
                <p className="text-xs text-sidebar-foreground/70 truncate group-hover:text-sidebar-accent-foreground/80">
                  {channel.topic}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {channel.userCount !== undefined && (
                <span className="text-xs text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground/80 flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  {channel.userCount}
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 opacity-70 group-hover:opacity-100 text-sidebar-foreground group-hover:text-sidebar-accent-foreground group-hover:bg-sidebar-primary/20"
                onClick={() => onJoinChannel(channel.name)}
                aria-label={`Join channel ${channel.name}`}
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
