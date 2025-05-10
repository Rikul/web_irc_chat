"use client";

import * as z from "zod"; // Import zod
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ServerConnection } from "@/lib/types";
import { LogIn } from "lucide-react";

const formSchema = z.object({
  host: z.string().min(1, "Host is required."),
  port: z.coerce.number().min(1, "Port is required.").max(65535),
  nickname: z.string().min(1, "Nickname is required.").max(32),
  password: z.string().optional(),
  realName: z.string().optional(),
});

type ConnectFormValues = z.infer<typeof formSchema>;

interface ConnectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (details: Omit<ServerConnection, "id" | "isConnected">) => void;
}

export function ConnectDialog({ isOpen, onOpenChange, onConnect }: ConnectDialogProps) {
  const form = useForm<ConnectFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      host: "",
      port: 6667,
      nickname: "",
      password: "",
      realName: "",
    },
  });

  function onSubmit(values: ConnectFormValues) {
    onConnect(values);
    onOpenChange(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" /> Connect to Server
          </DialogTitle>
          <DialogDescription>
            Enter the details of the IRC server you want to connect to.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server Host</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., irc.libera.chat" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="6667" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname</FormLabel>
                  <FormControl>
                    <Input placeholder="YourNick" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password (Optional)</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Server password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="realName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Real Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Real Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <LogIn className="mr-2 h-4 w-4" /> Connect
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
