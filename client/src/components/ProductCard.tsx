import { type Product } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpiryAlert } from "./ExpiryAlert";
import { differenceInDays, isPast, format, isValid } from "date-fns";
import { AlertOctagon } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  product: Product;
  showQr?: boolean;
  onDemolished?: () => void;
  isDemolishing?: boolean;
}

export function ProductCard({ product, showQr = false, onDemolished, isDemolishing }: ProductCardProps) {
  const date = new Date(product.expiryDate as any);
  const isExpired = isValid(date) && isPast(date) && differenceInDays(date, new Date()) < 0;
  
  const [keepIt, setKeepIt] = useState(false);

  if (isExpired && !keepIt && onDemolished) {
    return (
      <Card className="overflow-hidden border border-red-500 bg-red-50 relative group">
        <div className="p-6 text-center flex flex-col items-center justify-center min-h-[300px]">
          <AlertOctagon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-700 mb-1">{product.name}</h3>
          <p className="text-md font-semibold text-red-600 mb-2">Batch: {product.batchId || "Standard"}</p>
          <h4 className="text-lg font-bold text-red-700 mb-2">has Expired!</h4>
          <p className="text-sm text-red-600 mb-6">What would you like to do with this item?</p>
          <div className="flex gap-4 justify-center w-full">
            <Button variant="destructive" disabled={isDemolishing} onClick={() => onDemolished()}>
              {isDemolishing ? "Demolishing..." : "Demolished"}
            </Button>
            <Button variant="outline" className="border-red-500 text-red-700 hover:bg-red-100" onClick={() => setKeepIt(true)}>
              Keep it
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden card-hover group border border-border/50 bg-white">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-foreground font-display group-hover:text-primary transition-colors">
                {product.name}
              </h3>
              {product.batchId && (
                <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-md font-medium">
                  {product.batchId}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-primary mt-1">
              ₹{(product.price / 100).toFixed(2)}
            </p>
          </div>
          <ExpiryAlert expiryDate={product.expiryDate} />
        </div>

        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex justify-between">
            <span>Mfg Date:</span>
            <span className="font-medium text-foreground">{(() => {
              const d = new Date(product.manufacturingDate as any);
              return isValid(d) ? format(d, 'PP') : "N/A";
            })()}</span>
          </div>
          <div className="flex justify-between">
            <span>Expiry Date:</span>
            <span className="font-medium text-foreground">{(() => {
              const d = new Date(product.expiryDate as any);
              return isValid(d) ? format(d, 'PP') : "N/A";
            })()}</span>
          </div>
        </div>

        {Boolean(product.nutritionalInfo) && (
          <div className="mt-4 text-sm">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Nutritional Info</h4>
            {typeof product.nutritionalInfo === 'object' && product.nutritionalInfo !== null ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(product.nutritionalInfo as Record<string, any>).map(([key, value]) => (
                  <span key={key} className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md text-xs capitalize">
                    <span className="font-medium opacity-75">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {String(value)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-foreground">{String(product.nutritionalInfo)}</p>
            )}
          </div>
        )}

        {product.ingredients && product.ingredients.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Ingredients</h4>
            <div className="flex flex-wrap gap-1">
              {product.ingredients.map((ing, i) => (
                <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
