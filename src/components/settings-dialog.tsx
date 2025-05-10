
"use client";

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import React, { useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ServerConnection } from "@/lib/types";
import { Settings, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  nickname: z.string().min(1, "Nickname is required.").max(32),
  realName: z.string().optional(),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
});

export type SettingsFormValues = z.infer<typeof formSchema>;

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: Pick<ServerConnection, "nickname" | "realName" | "email"> | null;
  onSave: (newSettings: SettingsFormValues) => void;
}

export function SettingsDialog({ isOpen, onOpenChange, currentSettings, onSave }: SettingsDialogProps) {
  const { toast } = useToast();
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: currentSettings?.nickname || "ViteUser",
      realName: currentSettings?.realName || "",
      email: currentSettings?.email || "",
    },
  });

  useEffect(() => {
    if (currentSettings) {
      form.reset({
        nickname: currentSettings.nickname,
        realName: currentSettings.realName || "",
        email: currentSettings.email || "",
      });
    }
  }, [currentSettings, form, isOpen]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('vitechat-theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleThemeChange = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('vitechat-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('vitechat-theme', 'light');
    }
    toast({ title: "Theme Changed", description: `Switched to ${newTheme} mode.` });
  };

  function onSubmit(values: SettingsFormValues) {
    onSave(values);
    onOpenChange(false);
    toast({ title: "Settings Saved", description: "Your user details have been updated."});
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Application Settings
          </DialogTitle>
          <DialogDescription>
            Manage your application theme and user details for the current connection.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="theme-switcher" className="text-sm font-medium">Theme</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="theme-switcher"
                  checked={theme === 'dark'}
                  onCheckedChange={handleThemeChange}
                  aria-label="Toggle dark mode"
                />
                <Label htmlFor="theme-switcher" className="text-sm text-muted-foreground">
                  {theme === 'dark' ? "Dark Mode" : "Light Mode"}
                </Label>
              </div>
            </div>
            
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
              name="realName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Real Name</FormLabel>
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
                  <FormLabel>Email</FormLabel>
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
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
