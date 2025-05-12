
"use client";

import type { Message } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

interface ServerLogDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  serverName: string | undefined;
}

export function ServerLogDialog({
  isOpen,
  onOpenChange,
  messages,
  serverName,
}: ServerLogDialogProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && viewportRef.current) {
      // A slight delay can sometimes help ensure the scroll happens after all DOM updates.
      setTimeout(() => {
        if (viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
      }, 100); // Increased delay slightly for dialogs
    }
  }, [messages, isOpen]);


  if (!serverName) return null;

  const renderMessageContent = (msg: Message) => {
    // Customize rendering for server log messages if needed
    if (msg.type === 'raw' && msg.rawLine) return msg.rawLine;
    return msg.content;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-4 rounded-lg shadow-xl">
        <DialogHeader className="flex-shrink-0 border-b pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Terminal className="h-5 w-5 text-primary" /> Server Log: {serverName}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Raw IRC messages, server notices, and connection status.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow bg-muted/20 rounded-md border p-1 text-xs min-h-0 my-3" ref={scrollAreaRef}>
          <div className="p-2 space-y-1.5" ref={viewportRef}>
            {messages.length === 0 && (
              <div className="text-muted-foreground text-center py-4">
                No server messages yet.
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2 items-start">
                <span className="text-muted-foreground shrink-0 pt-px font-mono">
                  [{format(new Date(msg.timestamp), "HH:mm:ss")}]
                </span>
                <span
                  className={cn(
                    "break-all leading-relaxed",
                    msg.type === "error" && "text-destructive font-semibold",
                    msg.type === "info" && "text-sky-600 dark:text-sky-400",
                    msg.type === "system" && "text-indigo-600 dark:text-indigo-400",
                    msg.type === "notice" && "text-yellow-700 dark:text-yellow-500",
                    msg.type === "raw" && "font-mono text-gray-500 dark:text-gray-400 text-[0.9em]"
                  )}
                >
                  {msg.type === "raw" && <span className="font-bold text-purple-600 dark:text-purple-400">RAW: </span>}
                  {renderMessageContent(msg)}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <DialogClose asChild className="flex-shrink-0 self-end">
          <Button type="button" variant="outline">
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
