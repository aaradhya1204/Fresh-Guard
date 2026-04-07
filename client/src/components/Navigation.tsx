import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, ShoppingCart, Scan } from "lucide-react";

export function Navigation() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex-shrink-0 flex items-center cursor-pointer">
              <span className="font-display text-2xl font-bold text-primary tracking-tight">
                FreshGuard
              </span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {isAdmin ? (
                <Link href="/admin" className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${location === '/admin' ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  Admin Dashboard
                </Link>
              ) : (
                <Link href="/dashboard" className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${location === '/dashboard' ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  My Purchases
                </Link>
              )}
              {/* Common route accessible by both for demo purposes */}
              <Link href="/trolley" className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${location === '/trolley' ? 'border-primary text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Smart Trolley
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground hidden md:inline-block">
              {user.username} ({user.role})
            </span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className="sm:hidden border-t border-gray-200">
        <div className="flex justify-around p-2">
           <Link href={isAdmin ? "/admin" : "/dashboard"}>
             <Button variant="ghost" size="icon" className={location === (isAdmin ? '/admin' : '/dashboard') ? 'text-primary bg-primary/10' : ''}>
               {isAdmin ? <LayoutDashboard className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
             </Button>
           </Link>
           <Link href="/trolley">
             <Button variant="ghost" size="icon" className={location === '/trolley' ? 'text-primary bg-primary/10' : ''}>
               <Scan className="h-5 w-5" />
             </Button>
           </Link>
        </div>
      </div>
    </nav>
  );
}
