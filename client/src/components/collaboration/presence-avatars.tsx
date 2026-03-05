import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PresenceUser {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastHeartbeat: Date;
  socketId: string;
}

interface PresenceAvatarsProps {
  users: PresenceUser[];
  currentUserId: string;
  className?: string;
  maxAvatars?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(userId: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-cyan-500",
  ];
  
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function PresenceAvatars({ 
  users, 
  currentUserId, 
  className,
  maxAvatars = 5 
}: PresenceAvatarsProps) {
  const otherUsers = users.filter(u => u.userId !== currentUserId);
  const displayUsers = otherUsers.slice(0, maxAvatars);
  const remainingCount = otherUsers.length - maxAvatars;

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div 
      className={cn("flex items-center gap-2", className)}
      data-testid="presence-avatars-container"
    >
      <div className="flex items-center -space-x-2">
        {displayUsers.map((user) => (
          <TooltipProvider key={user.userId} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar 
                  className={cn(
                    "h-8 w-8 border-2 border-background cursor-pointer transition-transform hover:scale-110 hover:z-10",
                    getAvatarColor(user.userId)
                  )}
                  data-testid={`presence-avatar-${user.userId}`}
                >
                  <AvatarImage src={undefined} alt={user.userName} />
                  <AvatarFallback className="text-white text-xs font-medium">
                    {getInitials(user.userName)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm font-medium">{user.userName}</p>
                <p className="text-xs text-muted-foreground">
                  Viewing this event
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}

        {remainingCount > 0 && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar 
                  className="h-8 w-8 border-2 border-background bg-muted cursor-pointer transition-transform hover:scale-110 hover:z-10"
                  data-testid="presence-avatar-overflow"
                >
                  <AvatarFallback className="text-muted-foreground text-xs font-medium">
                    +{remainingCount}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm font-medium">
                  {remainingCount} more {remainingCount === 1 ? 'person' : 'people'} viewing
                </p>
                <ul className="mt-1 space-y-0.5">
                  {otherUsers.slice(maxAvatars).map(user => (
                    <li key={user.userId} className="text-xs text-muted-foreground">
                      {user.userName}
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <Badge 
        variant="secondary" 
        className="text-xs font-medium"
        data-testid="presence-count-badge"
      >
        <Users className="h-3 w-3 mr-1" />
        {otherUsers.length} {otherUsers.length === 1 ? 'person' : 'people'} viewing
      </Badge>
    </div>
  );
}
