import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserAvatarProps {
  firstName: string;
  lastName: string;
  className?: string;
}

export function UserAvatar({ firstName, lastName, className = 'h-10 w-10' }: UserAvatarProps) {
  const getInitials = (first: string, last: string) => {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  return (
    <Avatar className={className}>
      <AvatarFallback className={className === 'h-8 w-8' ? 'text-xs' : ''}>
        {getInitials(firstName, lastName)}
      </AvatarFallback>
    </Avatar>
  );
}
