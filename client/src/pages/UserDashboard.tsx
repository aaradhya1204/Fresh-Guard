import { usePurchases } from "@/hooks/use-purchases";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";

export default function UserDashboard() {
  const { purchases, isLoading, remove } = usePurchases();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPurchases = purchases?.filter((item) =>
    item?.product?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm pt-8 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">My Purchases</h1>
          <p className="text-muted-foreground">Track expiry dates and freshness of your groceries.</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input 
            placeholder="Search your items..." 
            className="pl-10 h-12 bg-white shadow-md border-transparent focus:border-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[300px] rounded-xl" />
            ))}
          </div>
        ) : filteredPurchases && filteredPurchases.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPurchases.map((item, index) => {
              // Defensive: older server responses returned a flattened purchase shape.
              const purchasedAt = (item as any)?.purchase?.purchasedAt ?? (item as any)?.purchasedAt;

              return (
                <div key={index} className="relative group">
                  {purchasedAt ? (
                    <div className="absolute top-2 left-2 z-10 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                      Purchased {format(new Date(purchasedAt), "MMM d")}
                    </div>
                  ) : null}
                  <ProductCard 
                    product={(item as any).product} 
                    onDemolished={() => remove.mutate((item as any).purchase.id)}
                    isDemolishing={remove.isPending && remove.variables === (item as any).purchase.id}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed border-gray-200">
            <ShoppingBag className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900">No purchases found</h3>
            <p className="text-gray-500 mt-2">Visit the Smart Trolley to buy items!</p>
          </div>
        )}
      </main>
    </div>
  );
}
