import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useProductByQr } from "@/hooks/use-products";
import { usePurchases } from "@/hooks/use-purchases";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpiryAlert } from "@/components/ExpiryAlert";
import { Loader2, ShoppingCart, Trash, Check, Plus, Minus } from "lucide-react";
import { type Product } from "@shared/schema";
import { differenceInDays, format, isPast, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function TrolleyPage() {
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [manualQrInput, setManualQrInput] = useState("");
  const [cart, setCart] = useState<Product[]>([]);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastWarnedProductIdRef = useRef<number | null>(null);
  const { data: scannedProduct, isLoading: isLoadingProduct } = useProductByQr(scannedId || undefined);
  const { create: checkout } = usePurchases();
  const isCheckingOut = checkout.isPending;
  const { toast } = useToast();

  const handleManualQrSubmit = () => {
    if (manualQrInput.trim()) {
      setScannedId(manualQrInput.trim());
      setManualQrInput("");
    }
  };

  useEffect(() => {
    // Initialize QR Scanner
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        setScannedId(decodedText);
      },
      (error) => {
        // console.warn(error);
      }
    );

    return () => {
      scannerRef.current?.clear().catch(console.error);
    };
  }, []);

  const addToCart = () => {
    if (scannedProduct) {
      setCart([...cart, scannedProduct]);
      setScannedId(null);
      toast({ title: "Added to trolley" });
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const productIds = cart.map(p => p.id);
    checkout.mutate(productIds, {
      onSuccess: () => {
        setCart([]);
        setScannedId(null);
      }
    });
  };

  const groupedCart = cart.reduce((acc, item) => {
    const existing = acc.find((g) => g.product.id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      acc.push({ product: item, quantity: 1 });
    }
    return acc;
  }, [] as { product: Product; quantity: number }[]);

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  const addOne = (product: Product) => {
    setCart([...cart, product]);
  };

  const removeOne = (productId: number) => {
    const index = cart.findIndex((p) => p.id === productId);
    if (index !== -1) {
      const newCart = [...cart];
      newCart.splice(index, 1);
      setCart(newCart);
    }
  };

  const removeAll = (productId: number) => {
    setCart(cart.filter((p) => p.id !== productId));
  };

  useEffect(() => {
    if (!scannedProduct) return;
    if (lastWarnedProductIdRef.current === scannedProduct.id) return;

    const expiry = new Date(scannedProduct.expiryDate as any);
    if (!isValid(expiry)) return;

    const daysLeft = differenceInDays(expiry, new Date());
    const expired = isPast(expiry) && daysLeft < 0;

    if (expired) {
      toast({
        variant: "destructive",
        title: "Expired product",
        description: `${scannedProduct.name} is expired.`,
      });
      lastWarnedProductIdRef.current = scannedProduct.id;
      return;
    }

    if (daysLeft <= 1) {
      toast({
        title: "Expiring soon",
        description: `${scannedProduct.name} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
      });
      lastWarnedProductIdRef.current = scannedProduct.id;
    }
  }, [scannedProduct, toast]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Scanner & Current Item */}
        <div className="space-y-6">
          <Card className="p-6 bg-white shadow-xl border-0 overflow-hidden">
            <h2 className="text-xl font-bold mb-4 font-display flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">1</span>
              Scan Item
            </h2>
            <div id="reader" className="rounded-lg overflow-hidden border-2 border-dashed border-gray-300"></div>
            <p className="text-xs text-center text-muted-foreground mt-2">Point camera at a product QR code</p>
            
            {/* Manual QR Entry for demo/testing */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Or enter QR code ID manually:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. prod_milk_001"
                  value={manualQrInput}
                  onChange={(e) => setManualQrInput(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="input-manual-qr"
                  onKeyDown={(e) => e.key === 'Enter' && handleManualQrSubmit()}
                />
                <Button onClick={handleManualQrSubmit} data-testid="button-lookup-qr">Lookup</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Demo QR IDs: <code className="bg-gray-100 px-1 rounded">prod_milk_001</code>, <code className="bg-gray-100 px-1 rounded">prod_bread_002</code>, <code className="bg-gray-100 px-1 rounded">prod_yogurt_003</code></p>
            </div>
          </Card>

          {/* Scanned Product Result */}
          {scannedId && (
            <Card className="p-6 bg-white shadow-2xl border-primary/20 animate-in fade-in slide-in-from-bottom-4">
              {isLoadingProduct ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : scannedProduct ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold text-gray-900">{scannedProduct.name}</h3>
                        {scannedProduct.batchId && (
                          <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-md font-medium">
                            Batch: {scannedProduct.batchId}
                          </span>
                        )}
                      </div>
                      <p className="text-3xl font-bold text-primary mt-1">₹{(scannedProduct.price / 100).toFixed(2)}</p>
                    </div>
                    <ExpiryAlert expiryDate={scannedProduct.expiryDate} size="lg" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                    <div>
                      <span className="text-gray-500 block">Manufactured</span>
                      <span className="font-medium">{(() => {
                        const d = new Date(scannedProduct.manufacturingDate as any);
                        return isValid(d) ? format(d, 'PP') : "N/A";
                      })()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Expires</span>
                      <span className="font-medium">{(() => {
                        const d = new Date(scannedProduct.expiryDate as any);
                        return isValid(d) ? format(d, 'PP') : "N/A";
                      })()}</span>
                    </div>
                  </div>

                  {Boolean(scannedProduct.nutritionalInfo) && (
                    <div className="text-sm">
                      <span className="text-gray-500 block font-medium mb-1">Nutritional Info</span>
                      {typeof scannedProduct.nutritionalInfo === 'object' && scannedProduct.nutritionalInfo !== null ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(scannedProduct.nutritionalInfo as Record<string, any>).map(([key, value]) => (
                            <span key={key} className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md text-xs capitalize">
                              <span className="font-medium opacity-75">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {String(value)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-900">{String(scannedProduct.nutritionalInfo)}</p>
                      )}
                    </div>
                  )}

                  {scannedProduct.ingredients && scannedProduct.ingredients.length > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-500 block font-medium mb-1">Ingredients</span>
                      <div className="flex flex-wrap gap-1">
                        {scannedProduct.ingredients.map((ing, i) => (
                          <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md border">
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setScannedId(null)}>Cancel</Button>
                    <Button className="flex-1 text-lg h-12 shadow-lg shadow-primary/25" onClick={addToCart}>
                      Add to Trolley
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 text-destructive font-medium">Product not found in database</div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column: Cart */}
        <div className="lg:h-[calc(100vh-6rem)] flex flex-col">
          <Card className="flex-1 flex flex-col bg-white shadow-xl border-0 overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">2</span>
                Your Trolley
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                  <p>Your trolley is empty</p>
                </div>
              ) : (
                groupedCart.map((group, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-lg border bg-white hover:border-primary/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{group.product.name}</p>
                        {group.product.batchId && (
                          <span className="text-xs text-muted-foreground border px-1.5 rounded bg-gray-50">
                            {group.product.batchId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">₹{(group.product.price / 100).toFixed(2)}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => removeOne(group.product.id)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{group.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => addOne(group.product)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => removeAll(group.product.id)}>
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t">
              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-medium text-gray-600">Total</span>
                <span className="text-3xl font-bold text-gray-900">₹{(total / 100).toFixed(2)}</span>
              </div>
              <Button 
                className="w-full h-14 text-xl shadow-xl shadow-primary/20" 
                disabled={cart.length === 0 || isCheckingOut}
                onClick={handleCheckout}
              >
                {isCheckingOut ? (
                  <><Loader2 className="animate-spin mr-2" /> Processing...</>
                ) : (
                  <><Check className="mr-2" /> Checkout & Pay</>
                )}
              </Button>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
