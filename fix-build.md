# Fix Build Errors - Missing Index Files

Your Cloud Build is failing because these index files are missing from your GitHub repository:

## 1. Create: `src/components/ui/index.ts`

```typescript
export { Button } from './button';
export { Badge } from './badge';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from './card';
export { Input } from './input';
export { Alert, AlertDescription, AlertTitle } from './alert';
export { Skeleton } from './skeleton';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export { Progress } from './progress';
export { Label } from './label';
export { Textarea } from './textarea';
export { Checkbox } from './checkbox';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
export { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from './sheet';
export { Toaster } from './toaster';
export { toast } from './toast';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
export { Switch } from './switch';
export { RadioGroup, RadioGroupItem } from './radio-group';
export { Slider } from './slider';
export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './table';
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';
export { Avatar, AvatarFallback, AvatarImage } from './avatar';
export { Calendar } from './calendar';
export { Popover, PopoverContent, PopoverTrigger } from './popover';
export { Separator } from './separator';
export { ScrollArea } from './scroll-area';
export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './form';
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
```

## 2. Create: `src/lib/index.ts`

```typescript
export { PlaceHolderImages } from './placeholder-images';
export type { ImagePlaceholder } from './placeholder-images';
export { cn } from './utils';
export * from './types';
export * from './api';
```

## Steps to Fix:

1. **Add these files to your GitHub repository**
2. **Commit and push to main branch**
3. **Trigger the Cloud Build again**

The build will succeed once these index files are in your repository!