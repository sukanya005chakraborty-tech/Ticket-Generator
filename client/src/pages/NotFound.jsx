import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, TicketIcon } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-secondary-900 p-6">
      <div className="max-w-md w-full text-center">
        {/* Large 404 */}
        <div className="relative mb-8">
          <p className="text-[10rem] font-black text-gray-100 dark:text-secondary-800 leading-none select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-5 bg-white dark:bg-secondary-800 rounded-2xl shadow-lg border border-gray-200 dark:border-secondary-700">
              <TicketIcon className="w-12 h-12 text-primary-500" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Page Not Found
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          Sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            icon={Home}
            onClick={() => navigate('/dashboard')}
            size="lg"
          >
            Go to Dashboard
          </Button>
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => navigate(-1)}
            size="lg"
          >
            Go Back
          </Button>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-secondary-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
