'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OrganizationAdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.role !== 'ORGANIZATION_ADMIN') {
      router.push('/login');
    }
  }, [user, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold">Organization Admin Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center">
              <span className="mr-4">{user.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Organization Management</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded shadow">
                  <h3 className="text-lg font-semibold">Organization Profile</h3>
                  <p className="text-gray-600">View and edit organization details</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                  <h3 className="text-lg font-semibold">Members</h3>
                  <p className="text-gray-600">Manage organization members</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                  <h3 className="text-lg font-semibold">Subscription</h3>
                  <p className="text-gray-600">View and manage subscription</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                  <h3 className="text-lg font-semibold">Billing</h3>
                  <p className="text-gray-600">View payment history</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
