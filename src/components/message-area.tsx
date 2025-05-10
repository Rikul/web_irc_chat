"use client";

import type { Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRightCircle, ArrowLeftCircle, Info, AlertTriangle, UserPlus, UserMinus, LogOutIcon } from "lucide-react";


interface MessageAreaProps {
  messages: Message[];
  channelName?: string;
}

export function MessageArea({ messages, channelName }: MessageAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);


  const renderMessageContent = (msg: Message) => {
    switch (msg.type) {
      case 'join':
        return <span className="flex items-center gap-1"><UserPlus className="h-4 w-4 text-green-500" /> {msg.nickname} has joined {channelName}.</span>;
      case 'part':
        return <span className="flex items-center gap-1"><UserMinus className="h-4 w-4 text-red-500" /> {msg.nickname} has left {channelName}. {msg.content && `(${msg.content})`}</span>;
      case 'quit':
         return <span className="flex items-center gap-1"><LogOutIcon className="h-4 w-4 text-red-500" /> {msg.nickname} has quit. {msg.content && `(${msg.content})`}</span>;
      case 'system':
        return <span className="flex items-center gap-1"><Info className="h-4 w-4 text-blue-500" />{msg.content}</span>;
      case 'error':
        return <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-red-600" />Error: {msg.content}</span>;
      case 'info':
         return <span className="flex items-center gap-1"><Info className="h-4 w-4 text-sky-500" />{msg.content}</span>;
      default:
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
              msg.isSelf ? "justify-end" : "justify-start",
              (msg.type !== 'message') && "justify-center"
            )}
          >
            {msg.type === 'message' && !msg.isSelf && (
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
                (msg.type !== 'message') && "max-w-full text-center"
              )}
            >
              {msg.type === 'message' && (
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
                  msg.isSelf && msg.type === 'message'
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : msg.type === 'message' 
                    ? "bg-secondary text-secondary-foreground rounded-bl-none"
                    : "text-muted-foreground text-xs italic bg-transparent px-0 py-1"
                )}
              >
                {renderMessageContent(msg)}
              </div>
               {(msg.type !== 'message') && (
                 <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(msg.timestamp), "HH:mm")}
                  </div>
               )}
            </div>
             {msg.type === 'message' && msg.isSelf && (
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
            No messages yet in {channelName || "this channel"}.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
