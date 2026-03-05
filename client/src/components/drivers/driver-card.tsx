import { Phone, Mail, Car, MapPin, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Driver {
  id: number;
  name: string;
  phone: string;
  email: string;
  vehicleType: string;
  licenseNumber: string;
  availability: "available" | "busy" | "off-duty";
  zone: string;
  area: string;
}

interface DriverCardProps {
  driver: Driver;
  onEdit: (driver: Driver) => void;
  onDelete: (id: number) => void;
}

export function DriverCard({ driver, onEdit, onDelete }: DriverCardProps) {
  const getAvailabilityColor = () => {
    switch (driver.availability) {
      case "available":
        return "bg-green-100 text-green-800"
      case "busy":
        return "bg-yellow-100 text-yellow-800"
      case "off-duty":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  };

  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Car className="h-5 w-5" />
            {driver.name}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(driver)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(driver.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Badge className={getAvailabilityColor()}>
          {driver.availability.replace("-", " ")}
        </Badge>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
        {driver.area && (
          <div className="bg-brand-primary-lighter dark:bg-brand-primary-darker/20 border border-brand-primary/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-primary" />
              <span className="text-base font-semibold text-brand-primary-darker dark:text-brand-primary-light">
                {driver.area}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-300">
          <Phone className="h-5 w-5" />
          <a href={`tel:${driver.phone}`} className="hover:text-brand-primary">
            {driver.phone}
          </a>
        </div>

        <div className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-300">
          <Mail className="h-5 w-5" />
          <a href={`mailto:${driver.email}`} className="hover:text-brand-primary truncate">
            {driver.email}
          </a>
        </div>

        {driver.vehicleType && (
          <div className="flex items-center gap-2 text-base">
            <Car className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{driver.vehicleType}</span>
          </div>
        )}

        {driver.zone && (
          <div className="flex items-center gap-2 text-base text-gray-700 dark:text-gray-300">
            <MapPin className="h-5 w-5" />
            <span><strong>Zone:</strong> {driver.zone}</span>
          </div>
        )}

        {driver.licenseNumber && (
          <div className="text-sm text-gray-500">
            DL# on file
          </div>
        )}
      </CardContent>
    </Card>
  );
}