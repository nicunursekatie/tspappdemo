import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Check, X, User, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
}

interface Driver {
  id: number;
  name: string;
  email: string;
  phone: string;
  temporarilyUnavailable?: boolean;
}

interface VolunteerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVolunteers: (volunteers: string[]) => void;
  selectedVolunteers: string[];
  eventId: number;
}

export function VolunteerSelectionModal({
  isOpen,
  onClose,
  onSelectVolunteers,
  selectedVolunteers,
  eventId,
}: VolunteerSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelectedVolunteers, setTempSelectedVolunteers] =
    useState<string[]>(selectedVolunteers);
  const [customVolunteerName, setCustomVolunteerName] = useState('');
  const [showCustomVolunteerInput, setShowCustomVolunteerInput] =
    useState(false);

  // Reset temp selection when modal opens
  useEffect(() => {
    setTempSelectedVolunteers(selectedVolunteers);
    setCustomVolunteerName('');
    setShowCustomVolunteerInput(false);
  }, [selectedVolunteers, isOpen]);

  // Fetch available users for volunteer assignments
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users/for-assignments'],
    enabled: isOpen,
  });

  // Fetch drivers for volunteer assignments (multi-faceted volunteers)
  const { data: drivers = [], isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
    enabled: isOpen,
  });

  const isLoading = usersLoading || driversLoading;

  // Filter users and drivers based on search term
  const filteredUsers = users.filter((user) => {
    const name =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.displayName || user.email || '';
    const email = user.email || '';
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredDrivers = drivers.filter((driver) => {
    const name = driver.name || '';
    const email = driver.email || '';
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getUserDisplayName = (user: User) => {
    // If we have both first and last names, use them
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    
    // If we have a displayName, check if it looks like an email
    if (user.displayName && !user.displayName.includes('@')) {
      return user.displayName;
    }
    
    // Default fallback for missing names or email-like displayNames
    return 'Unknown User';
  };

  const toggleVolunteerSelection = (volunteerId: string) => {
    setTempSelectedVolunteers((prev) =>
      prev.includes(volunteerId)
        ? prev.filter((id) => id !== volunteerId)
        : [...prev, volunteerId]
    );
  };

  const addCustomVolunteer = () => {
    if (customVolunteerName.trim()) {
      setTempSelectedVolunteers((prev) => [
        ...prev,
        customVolunteerName.trim(),
      ]);
      setCustomVolunteerName('');
      setShowCustomVolunteerInput(false);
    }
  };

  const removeVolunteer = (volunteerId: string) => {
    setTempSelectedVolunteers((prev) =>
      prev.filter((id) => id !== volunteerId)
    );
  };

  const handleSave = () => {
    onSelectVolunteers(tempSelectedVolunteers);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedVolunteers(selectedVolunteers);
    setCustomVolunteerName('');
    setShowCustomVolunteerInput(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select Volunteers
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search volunteers by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected Volunteers */}
          {tempSelectedVolunteers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">
                Selected Volunteers ({tempSelectedVolunteers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {tempSelectedVolunteers.map((volunteerId, index) => {
                  const user = users.find((u) => u.id === volunteerId);
                  const driver = drivers.find(
                    (d) => d.id.toString() === volunteerId
                  );
                  const displayName = user
                    ? getUserDisplayName(user)
                    : driver
                      ? driver.name
                      : volunteerId;

                  return (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      {displayName}
                      <button
                        onClick={() => removeVolunteer(volunteerId)}
                        className="ml-2 hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Options */}
          <div className="flex-1">
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {/* Team Members */}
                {filteredUsers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Team Members
                    </h3>
                    <div className="space-y-1">
                      {filteredUsers.map((user) => {
                        const isSelected = tempSelectedVolunteers.includes(
                          user.id
                        );
                        return (
                          <div
                            key={user.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => toggleVolunteerSelection(user.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <User className="w-4 h-4 text-gray-400" />
                                <div>
                                  <div className="font-medium">
                                    {getUserDisplayName(user)}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Drivers */}
                {filteredDrivers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Drivers (Multi-faceted Volunteers)
                    </h3>
                    <div className="space-y-1">
                      {filteredDrivers.map((driver) => {
                        const driverId = driver.name; // Using name as ID for drivers
                        const isSelected =
                          tempSelectedVolunteers.includes(driverId);
                        return (
                          <div
                            key={driver.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => toggleVolunteerSelection(driverId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <User className="w-4 h-4 text-gray-400" />
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {driver.name}
                                    {driver.temporarilyUnavailable && (
                                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                        Volunteer only
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Volunteer Input */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Add Custom Volunteer
                  </h3>
                  {!showCustomVolunteerInput ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCustomVolunteerInput(true)}
                      className="w-full"
                    >
                      + Add custom volunteer name
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter volunteer name..."
                        value={customVolunteerName}
                        onChange={(e) => setCustomVolunteerName(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === 'Enter' && addCustomVolunteer()
                        }
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={addCustomVolunteer}
                        disabled={!customVolunteerName.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowCustomVolunteerInput(false);
                          setCustomVolunteerName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Save Volunteers ({tempSelectedVolunteers.length})
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-sm text-gray-500">Loading volunteers...</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
