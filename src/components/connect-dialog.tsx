"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import React from "react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ServerConnection } from "@/lib/types";
import { LogIn, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const PREDEFINED_SERVERS = [
  { value: "irc.libera.chat", label: "Libera.Chat" },
  { value: "irc.efnet.org", label: "EFNet" },
  { value: "irc.quakenet.org", label: "QuakeNet" },
  { value: "irc.undernet.org", label: "UnderNet" },
  { value: "irc.dal.net", label: "DALnet" },
  { value: "localhost", label: "Localhost (test)"}
];

const formSchema = z.object({
  host: z.string().min(1, "Host is required."),
  port: z.coerce.number().min(1, "Port is required.").max(65535),
  nickname: z.string().min(1, "Nickname is required.").max(32),
  password: z.string().optional(),
  realName: z.string().optional(),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
});

type ConnectFormValues = z.infer<typeof formSchema>;

interface ConnectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (details: Omit<ServerConnection, "id" | "isConnected">) => void;
}

export function ConnectDialog({ isOpen, onOpenChange, onConnect }: ConnectDialogProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  
  const form = useForm<ConnectFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      host: "",
      port: 6667,
      nickname: "ViteUser",
      password: "",
      realName: "ViteChat User",
      email: "",
    },
  });

  function onSubmit(values: ConnectFormValues) {
    onConnect(values);
    onOpenChange(false);
    // form.reset(); // Keep some values like nickname for next connection
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
                <FormItem className="flex flex-col">
                  <FormLabel>Server Host</FormLabel>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? PREDEFINED_SERVERS.find(
                                (server) => server.value === field.value
                              )?.label || field.value
                            : "Select or type server"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command shouldFilter={false} /* Allow typing custom values */ >
                        <CommandInput 
                          placeholder="Search or type server..."
                          onValueChange={(search) => {
                             // Allow typing custom server not in the list
                            if (!PREDEFINED_SERVERS.some(s => s.value.toLowerCase().includes(search.toLowerCase()) || s.label.toLowerCase().includes(search.toLowerCase()))) {
                               form.setValue("host", search, { shouldValidate: true });
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>No server found.</CommandEmpty>
                          <CommandGroup>
                            {PREDEFINED_SERVERS.map((server) => (
                              <CommandItem
                                key={server.value}
                                value={server.value}
                                onSelect={(currentValue) => {
                                  form.setValue("host", currentValue === field.value ? "" : currentValue);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === server.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {server.label} ({server.value})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your@email.com" {...field} />
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
