
"use client";

import type { Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserMinus, LogOutIcon, Info, AlertTriangle, Edit3, Settings2, ArrowRightLeft, Zap } from "lucide-react";


interface MessageAreaProps {
  messages: Message[];
  channelName?: string;
}

export function MessageArea({ messages, channelName }: MessageAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      // A slight delay can sometimes help ensure the scroll happens after all DOM updates.
      setTimeout(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages]);


  const renderMessageContent = (msg: Message) => {
    switch (msg.type) {
      case 'join':
        return <span className="flex items-center gap-1"><UserPlus className="h-4 w-4 text-green-500" /> {msg.nickname} has joined {msg.target}.</span>;
      case 'part':
        return <span className="flex items-center gap-1"><UserMinus className="h-4 w-4 text-red-500" /> {msg.nickname} has left {msg.target}. {msg.content && `(${msg.content})`}</span>;
      case 'quit':
         return <span className="flex items-center gap-1"><LogOutIcon className="h-4 w-4 text-gray-500" /> {msg.nickname} has quit. {msg.content && `(${msg.content})`}</span>;
      case 'kick':
        return <span className="flex items-center gap-1"><UserMinus className="h-4 w-4 text-orange-500" /> {msg.kicked} was kicked from {msg.target} by {msg.nickname}. {msg.kickReason && `(${msg.kickReason})`}</span>;
      case 'nick':
        return <span className="flex items-center gap-1"><Edit3 className="h-4 w-4 text-purple-500" /> {msg.oldNickname} is now known as {msg.nickname}.</span>;
      case 'mode':
        return <span className="flex items-center gap-1"><Settings2 className="h-4 w-4 text-blue-500" /> {msg.content}</span>;
      case 'topic':
        return <span className="flex items-center gap-1"><Info className="h-4 w-4 text-indigo-500" /> Topic for {msg.target} changed by {msg.nickname || 'server'} to: "{msg.content}"</span>;
      case 'system':
        return <span className="flex items-center gap-1"><Info className="h-4 w-4 text-blue-500" />{msg.content}</span>;
      case 'error':
        return <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-600" />Error: {msg.content}</span>;
      case 'info':
         return <span className="flex items-center gap-1"><Info className="h-4 w-4 text-sky-500" />{msg.content}</span>;
      case 'notice':
        return <span className="flex items-center gap-1"><Zap className="h-4 w-4 text-yellow-500" /> [{msg.nickname || 'SERVER'}] {msg.content}</span>;
      case 'action':
        return <span className="italic"><ArrowRightLeft className="inline h-4 w-4 mr-1 text-muted-foreground" /> * {msg.nickname} {msg.content}</span>;
      case 'raw':
        return <span className="font-mono text-xs">RAW: {msg.rawLine || msg.content}</span>;
      default: // 'message'
        return msg.content;
    }
  };


  return (
    <ScrollArea className="h-full flex-grow bg-background rounded-lg shadow-inner" ref={scrollAreaRef}>
      <div className="p-4 space-y-3" ref={viewportRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.isSelf && msg.type === 'message' ? "justify-end" : "justify-start",
              (msg.type !== 'message' && msg.type !== 'action') && "justify-start" // System messages, etc. on left
            )}
          >
            {(msg.type === 'message' || msg.type === 'action') && !msg.isSelf && msg.nickname && (
              <Avatar className="h-8 w-8 mr-2 self-start shrink-0">
                 <AvatarImage src={`https://picsum.photos/seed/${msg.nickname}/40/40`} data-ai-hint="avatar person" />
                 <AvatarFallback className="text-xs">
                  {msg.nickname?.substring(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "max-w-[70%]",
                (msg.type !== 'message' && msg.type !== 'action') && "max-w-full" // System messages can take full width
              )}
            >
              {(msg.type === 'message' || msg.type === 'action') && msg.nickname && (
                 <div className={cn("text-xs mb-0.5", msg.isSelf ? "text-right" : "text-left")}>
                  <span className={cn("font-semibold", !msg.isSelf && "text-primary")}>
                    {msg.isSelf ? "You" : msg.nickname}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {format(new Date(msg.timestamp), "HH:mm")}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "p-2 rounded-lg break-words",
                  msg.isSelf && (msg.type === 'message' || msg.type === 'action')
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : (msg.type === 'message' || msg.type === 'action')
                    ? "bg-secondary text-secondary-foreground rounded-bl-none"
                    : "text-muted-foreground text-xs bg-transparent px-0 py-1" // System messages style
                )}
              >
                {renderMessageContent(msg)}
              </div>
               {(msg.type !== 'message' && msg.type !== 'action') && ( // Timestamp for system messages
                 <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(msg.timestamp), "HH:mm:ss")}
                  </div>
               )}
            </div>
             {(msg.type === 'message' || msg.type === 'action') && msg.isSelf && msg.nickname && (
              <Avatar className="h-8 w-8 ml-2 self-start shrink-0">
                 <AvatarImage src={`https://picsum.photos/seed/${msg.nickname}/40/40`} data-ai-hint="avatar person" />
                 <AvatarFallback className="text-xs">
                  {msg.nickname?.substring(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
         {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-10">
            No messages yet in {channelName || "this view"}.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
