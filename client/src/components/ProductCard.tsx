import { type Product } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ExpiryAlert } from "./ExpiryAlert";
import { format, isValid } from "date-fns";

interface ProductCardProps {
  product: Product;
  showQr?: boolean;
}

export function ProductCard({ product, showQr = false }: ProductCardProps) {
  return (
    <Card className="overflow-hidden card-hover group border border-border/50 bg-white">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-foreground font-display group-hover:text-primary transition-colors">
              {product.name}
            </h3>
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
