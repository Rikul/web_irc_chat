
"use client";

import type { User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users as UsersIcon, ShieldCheck, Mic } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserListProps {
  users: User[];
}

const getModeSymbol = (user: User): string => {
  if (user.isOp) return "@";
  if (user.isVoice) return "+";
  // Could add other modes like half-op (%) if needed
  return "";
};

export function UserList({ users }: UserListProps) {
  const sortedUsers = [...users].sort((a, b) => {
    // Sort by op, then voice, then nickname
    if (a.isOp && !b.isOp) return -1;
    if (!a.isOp && b.isOp) return 1;
    if (a.isVoice && !b.isVoice) return -1;
    if (!a.isVoice && b.isVoice) return 1;
    return a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' });
  });

  return (
    <Card className="h-full flex flex-col shadow-md rounded-lg">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <UsersIcon className="h-5 w-5" />
          Users ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <ScrollArea className="h-full p-2">
          {sortedUsers.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No users in this channel.
            </div>
          ) : (
            <ul className="space-y-1">
              {sortedUsers.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={`https://picsum.photos/seed/${user.nickname}/32/32`} data-ai-hint="avatar person" />
                    <AvatarFallback className="text-xs">
                      {user.nickname.substring(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn("text-sm font-medium text-foreground", {"text-primary": user.isOp, "text-green-600 dark:text-green-400": user.isVoice && !user.isOp})}>
                    {getModeSymbol(user)}{user.nickname}
                  </span>
                  {/* {user.isOp && <ShieldCheck className="h-4 w-4 text-primary" title="Operator" />}
                  {user.isVoice && !user.isOp && <Mic className="h-4 w-4 text-green-600 dark:text-green-400" title="Voiced" />} */}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
