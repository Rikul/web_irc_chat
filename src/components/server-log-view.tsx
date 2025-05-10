
"use client";

import type { Message } from "@/lib/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ServerLogViewProps {
  messages: Message[];
}

export function ServerLogView({ messages }: ServerLogViewProps) {
  const renderMessageContent = (msg: Message) => {
    // Simplified rendering for server log
    return msg.content;
  };

  return (
    <Accordion type="single" collapsible className="w-full px-2 md:px-3" defaultValue="server-log">
      <AccordionItem value="server-log" className="border-t border-b-0">
        <AccordionTrigger className="py-2 text-sm hover:no-underline">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Server Log
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <ScrollArea className="h-40 max-h-60 bg-muted/30 rounded-md border p-1 text-xs">
            <div className="p-2 space-y-1.5">
            {messages.length === 0 && (
                <div className="text-muted-foreground text-center py-4">
                    No server messages yet.
                </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">
                  [{format(new Date(msg.timestamp), "HH:mm:ss")}]
                </span>
                <span
                  className={cn(
                    "break-all",
                    msg.type === "error" && "text-destructive",
                    msg.type === "info" && "text-blue-500 dark:text-blue-400" // Example distinct color
                  )}
                >
                  {renderMessageContent(msg)}
                </span>
              </div>
            ))}
            </div>
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
