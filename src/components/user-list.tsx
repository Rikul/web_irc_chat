"use client";

import type { User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users as UsersIcon, User as UserIcon } from "lucide-react"; // Renamed User to UserIcon to avoid conflict
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserListProps {
  users: User[];
}

export function UserList({ users }: UserListProps) {
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
          {users.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No users in this channel.
            </div>
          ) : (
            <ul className="space-y-1">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={`https://picsum.photos/seed/${user.nickname}/32/32`} data-ai-hint="avatar person" />
                    <AvatarFallback className="text-xs">
                      {user.nickname.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {user.nickname}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
