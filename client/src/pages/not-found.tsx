import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { AuthPageLayout } from '@/components/layout/responsive-page-layout';

export default function NotFound() {
  return (
    <AuthPageLayout title="Not Found" showBack>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start mb-4 gap-3 sm:gap-2">
              <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center sm:text-left">
                404 Page Not Found
              </h1>
            </div>

            <p className="mt-4 text-sm text-gray-600 text-center sm:text-left">
              The page you're looking for doesn't exist or has been moved.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <Link href="/dashboard">
                <Button className="w-full h-11">Go to Dashboard</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full h-11">Go to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthPageLayout>
  );
}
