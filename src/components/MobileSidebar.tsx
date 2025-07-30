import { useState } from 'react';
import { Menu, X, List, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MobileSidebarProps {
  onNavigate: (section: string) => void;
  currentSection: string;
}

export function MobileSidebar({ onNavigate, currentSection }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  const menuItems = [
    {
      id: 'reservations',
      label: 'Fazer uma Reserva',
      icon: Calendar,
    },
    {
      id: 'my-reservations',
      label: 'Minhas Reservas',
      icon: List,
    },
    {
      id: 'profile',
      label: 'Meu Perfil',
      icon: User,
    },
  ];

  const handleNavigate = (section: string) => {
    onNavigate(section);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentSection === item.id;
            
            return (
              <Button
                key={item.id}
                variant={isActive ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => handleNavigate(item.id)}
              >
                <IconComponent className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}