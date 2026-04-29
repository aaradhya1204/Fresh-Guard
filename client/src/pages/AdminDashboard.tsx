import { useProducts } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type InsertProduct } from "@shared/routes";
import { format, isValid } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Plus, Trash2, Tag, Calendar, AlertOctagon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { z } from "zod";
import { differenceInDays, isPast } from "date-fns";
import { type Product } from "@shared/schema";
import { ExpiryAlert } from "@/components/ExpiryAlert";

// Form schema: keep form values aligned with what the inputs actually collect.
// (Avoid Zod transforms here, since react-hook-form expects input types, not transformed output types.)
const formSchema = insertProductSchema.extend({
  price: z.coerce.number().min(0.01, "Price must be positive"),
  manufacturingDate: z.string().min(1, "Manufacturing date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  nutritionalInfo: z.string().min(1, "Nutritional info is required"),
  ingredients: z.string().optional().default(""),
  batchId: z.string().min(1, "Batch ID is required").default("Standard Batch"),
});

type ProductFormValues = z.infer<typeof formSchema>;

export default function AdminDashboard() {
  const { products, isLoading, create, remove } = useProducts();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      price: 0,
      manufacturingDate: "",
      expiryDate: "",
      nutritionalInfo: "Cal: 100, Prot: 5g, Carbs: 20g",
      ingredients: "",
      qrCodeId: crypto.randomUUID(), // Auto-generate QR
      batchId: `B-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`, // Default random batch ID
    }
  });

  const onSubmit = (data: ProductFormValues) => {
    const ingredients = (data.ingredients || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    console.log("Submitting product dates (client):", {
      manufacturingDate: data.manufacturingDate,
      expiryDate: data.expiryDate,
    });

    const nutritionalObj: Record<string, string> = {};
    data.nutritionalInfo.split(",").forEach(item => {
      const [key, val] = item.split(":").map(s => s.trim());
      if (key && val) {
        nutritionalObj[key.toLowerCase()] = val;
      }
    });
    if (Object.keys(nutritionalObj).length === 0) {
      nutritionalObj["info"] = data.nutritionalInfo;
    }

    // Server expects the DB insert shape (ingredients: string[]).
    const payload: InsertProduct = {
      name: data.name,
      price: Math.round(data.price * 100),
      nutritionalInfo: nutritionalObj,
      qrCodeId: data.qrCodeId,
      ingredients,
      manufacturingDate: data.manufacturingDate,
      expiryDate: data.expiryDate,
      batchId: data.batchId,
    };

    create.mutate(payload, {
      onSuccess: () => {
        setIsOpen(false);
        form.reset({
          name: "",
          price: 0,
          manufacturingDate: "",
          expiryDate: "",
          nutritionalInfo: "Cal: 100, Prot: 5g, Carbs: 20g",
          ingredients: "",
          qrCodeId: crypto.randomUUID(),
          batchId: `B-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm pt-8 pb-12 px-4 sm:px-6 lg:px-8 border-b">
        <div className="max-w-7xl mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">Inventory Management</h1>
            <p className="text-muted-foreground">Manage products and print QR codes.</p>
          </div>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20">
                <Plus className="w-5 h-5 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription className="sr-only">Add a new product to the inventory.</DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Organic Milk" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="batchId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch ID</FormLabel>
                        <FormControl><Input placeholder="e.g. B-01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (₹)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="qrCodeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>QR ID (Auto)</FormLabel>
                        <FormControl><Input {...field} readOnly className="bg-gray-100" /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="manufacturingDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mfg Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="expiryDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="nutritionalInfo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nutritional Info</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="ingredients" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ingredients (comma separated)</FormLabel>
                      <FormControl><Input placeholder="Milk, Vitamin D..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full" disabled={create.isPending}>
                    {create.isPending ? "Adding..." : "Add to Inventory"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products?.map((product) => (
              <AdminProductItem 
                key={product.id} 
                product={product} 
                onDelete={() => remove.mutate(product.id)}
                isDeleting={remove.isPending && remove.variables === product.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AdminProductItem({ product, onDelete, isDeleting }: { product: Product, onDelete: () => void, isDeleting: boolean }) {
  const date = new Date(product.expiryDate as any);
  const isExpired = isValid(date) && isPast(date) && differenceInDays(date, new Date()) < 0;
  
  const [keepIt, setKeepIt] = useState(false);

  if (isExpired && !keepIt) {
    return (
      <Card className="overflow-hidden border border-red-500 bg-red-50 relative group">
        <div className="p-6 text-center flex flex-col items-center justify-center min-h-[200px]">
          <AlertOctagon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-700 mb-1">{product.name}</h3>
          <p className="text-md font-semibold text-red-600 mb-2">Batch: {product.batchId || "Standard"}</p>
          <h4 className="text-lg font-bold text-red-700 mb-2">has Expired!</h4>
          <p className="text-sm text-red-600 mb-6">What would you like to do with this item?</p>
          <div className="flex gap-4 justify-center w-full">
            <Button variant="destructive" disabled={isDeleting} onClick={onDelete}>
              {isDeleting ? "Demolishing..." : "Demolished"}
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
    <Card className="overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{product.name}</h3>
              {product.batchId && (
                <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-md font-medium">
                  {product.batchId}
                </span>
              )}
            </div>
            <p className="text-primary font-bold">₹{(product.price / 100).toFixed(2)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <ExpiryAlert expiryDate={product.expiryDate} />
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg border shadow-sm">
            <QRCodeSVG value={product.qrCodeId} size={80} />
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="flex items-center gap-2"><Tag className="w-3 h-3" /> ID: {product.qrCodeId.slice(0, 8)}...</div>
            <div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> Exp: {(() => {
              if (!product.expiryDate) return "N/A";
              const d = new Date(product.expiryDate as any);
              return isValid(d) ? format(d, 'MMM d, yyyy') : "N/A";
            })()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
