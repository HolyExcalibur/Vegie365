/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Camera, 
  Trash2, 
  ChefHat, 
  Calendar, 
  Package, 
  Thermometer, 
  LogOut, 
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Snowflake,
  Refrigerator,
  Box,
  Users,
  Trophy,
  Share2,
  LayoutGrid,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch,
  increment,
  limit,
  setDoc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { format, addDays, differenceInDays, isPast } from 'date-fns';
import { toast, Toaster } from 'sonner';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { geminiService, ExtractedItem, GeneratedRecipe, CommunityRecipeResult } from './services/geminiService';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// --- Types ---

interface FoodItem {
  id: string;
  name: string;
  category: string;
  expiryDate: Timestamp;
  addedAt: Timestamp;
  storageCondition: 'fridge' | 'freezer' | 'pantry';
  quantity?: string;
  imageUrl?: string;
}

// --- Components ---

const AuthScreen = () => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back to Vegie365!');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/Password login is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please sign in instead.');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        toast.error('Invalid email or password.');
      } else {
        toast.error(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Welcome to Vegie365!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('Sign-in popup was blocked. Please allow popups for this site and try again.');
      } else if (error.code !== 'auth/cancelled-popup-request') {
        toast.error('Failed to sign in with Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInAnonymously(auth);
      toast.success('Welcome! You are browsing as a guest.');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to continue as guest.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-border"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-[#284134] rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <Refrigerator className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Vegie365</h1>
          <p className="text-sm text-muted-foreground">Smart food tracking for a sustainable household.</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <Button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full h-12 text-lg bg-[#284134] hover:bg-[#284134]/90 text-white rounded-xl transition-all"
          >
            {isLoggingIn ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : null}
            {isLoggingIn ? 'Authenticating...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            variant="outline" 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full h-12 text-base font-medium rounded-xl"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGuestLogin}
            disabled={isLoggingIn}
            className="w-full h-12 text-base font-medium rounded-xl text-muted-foreground"
          >
            <Users className="w-5 h-5 mr-2" />
            Guest (24h Session)
          </Button>
        </div>

        <div className="text-center mt-4">
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-[#284134] hover:underline font-medium"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ExpiryBadge = ({ date }: { date: Date }) => {
  const days = differenceInDays(date, new Date());
  
  if (isPast(date)) return <Badge variant="destructive">Expired</Badge>;
  if (days <= 2) return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">Urgent</Badge>;
  if (days <= 30) return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Fresh</Badge>;
  return <Badge variant="outline" className="text-muted-foreground border-border bg-blue-50">Stable</Badge>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<FoodItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [recipe, setRecipe] = useState<GeneratedRecipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentView, setCurrentView] = useState<'inventory' | 'community'>('inventory');
  const [userPoints, setUserPoints] = useState(0);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isProcessingRecipe, setIsProcessingRecipe] = useState(false);
  const [processedRecipe, setProcessedRecipe] = useState<CommunityRecipeResult | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storageTips = [
    "Store potatoes with an apple to keep them from sprouting.",
    "Keep tomatoes at room temperature to preserve their flavor.",
    "Wrap celery in aluminum foil to keep it crisp for weeks.",
    "Store onions and potatoes separately; they make each other spoil faster.",
    "Place herbs in a glass of water like a bouquet to extend their life.",
    "Don't wash berries until you're ready to eat them to prevent mold.",
    "Keep bananas away from other fruits unless you want them to ripen faster.",
    "Store mushrooms in a paper bag to prevent them from getting slimy.",
    "Keep milk in the main part of the fridge, not the door, for more stable temps.",
    "Store flour in the freezer to keep it fresh and prevent pests."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % storageTips.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Handle anonymous user 24-hour expiry
    if (user.isAnonymous) {
      const userDocRef = doc(db, 'users', user.uid);
      getDoc(userDocRef).then(async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.createdAt) {
            const createdTime = data.createdAt.toDate().getTime();
            const now = Date.now();
            if (now - createdTime > 24 * 60 * 60 * 1000) {
              // Older than 24 hours, delete inventory data and reset timer
              try {
                const invRef = collection(db, 'users', user.uid, 'inventory');
                const invSnap = await getDocs(invRef);
                const batch = writeBatch(db);
                invSnap.forEach(d => batch.delete(d.ref));
                batch.update(userDocRef, { createdAt: serverTimestamp(), points: 0 });
                await batch.commit();
                toast.info('Your 24-hour guest session expired. Your inventory has been reset.');
              } catch (err) {
                console.error("Failed to reset guest data:", err);
              }
            }
          }
        }
      });
    }

    // Listen to user points
    const userDocRef = doc(db, 'users', user.uid);
    const unsubPoints = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserPoints(data.points || 0);
        
        // Sync with leaderboard
        setDoc(doc(db, 'leaderboard', user.uid), {
          displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
          points: data.points || 0,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(err => console.error("Leaderboard sync error:", err));
      } else {
        setDoc(userDocRef, { 
          uid: user.uid,
          email: user.email || null,
          points: 0,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    });

    // Listen to community posts
    const postsRef = collection(db, 'community_posts');
    const qPosts = query(postsRef, orderBy('createdAt', 'desc'), limit(20));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      setCommunityPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'community_posts');
    });

    // Listen to leaderboard
    const leaderboardRef = collection(db, 'leaderboard');
    const qLeaderboard = query(leaderboardRef, orderBy('points', 'desc'), limit(5));
    const unsubLeaderboard = onSnapshot(qLeaderboard, (snapshot) => {
      setLeaderboard(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaderboard');
    });

    return () => {
      unsubPoints();
      unsubPosts();
      unsubLeaderboard();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'inventory'),
      orderBy('expiryDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FoodItem[];
      setInventory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/inventory`);
    });

    return unsubscribe;
  }, [user]);

  const handleLogout = () => signOut(auth);

  const handleRemoveAll = async () => {
    if (!user || inventory.length === 0) return;
    
    setIsDeletingAll(true);
    try {
      const batch = writeBatch(db);
      inventory.forEach((item) => {
        const docRef = doc(db, 'users', user.uid, 'inventory', item.id);
        batch.delete(docRef);
      });
      
      await batch.commit();
      toast.success('All items removed.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove all items.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleProcessCommunityRecipe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData(e.currentTarget);
    const ingredients = formData.get('ingredients') as string;
    const steps = formData.get('steps') as string;
    const imageFile = (e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement)?.files?.[0];

    setIsProcessingRecipe(true);
    try {
      let imageData: string | undefined;
      if (imageFile) {
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
      }

      const result = await geminiService.processCommunityRecipe({
        image: imageData,
        ingredients,
        steps
      });

      if (result.is_food_verified) {
        setProcessedRecipe(result);
        toast.success('Recipe processed successfully!');
      } else {
        toast.error(result.verification_message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to process recipe.');
    } finally {
      setIsProcessingRecipe(false);
    }
  };

  const handleConfirmDepletion = async (items: string[]) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      let depletedCount = 0;
      
      for (const itemName of items) {
        // Simple matching: find first item with similar name
        const itemToDeplete = inventory.find(i => 
          i.name.toLowerCase().includes(itemName.toLowerCase()) || 
          itemName.toLowerCase().includes(i.name.toLowerCase())
        );
        
        if (itemToDeplete) {
          batch.delete(doc(db, 'users', user.uid, 'inventory', itemToDeplete.id));
          depletedCount++;
        }
      }
      
      await batch.commit();
      setProcessedRecipe(null);
      toast.success(`Recipe logged! ${depletedCount} items removed from inventory.`);
      
      // Award points for sharing recipe
      const pointsResult = await geminiService.calculatePoints({
        items,
        category: 'Shared Recipe',
        originalShelfLife: 7,
        daysRemaining: 1,
        actionTaken: 'shared_recipe_online'
      });
      
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        points: increment(pointsResult.points_awarded)
      });
      
      toast.success(pointsResult.celebratory_message);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update inventory.');
    }
  };

  const handleRecalculateAll = async () => {
    if (!user || inventory.length === 0) return;
    setIsRecalculating(true);
    setLastAction('Recalculating all expiry dates...');
    
    try {
      let updatedCount = 0;
      for (const item of inventory) {
        const days = differenceInDays(item.expiryDate.toDate(), new Date());
        const result = await geminiService.recalculateExpiry(
          item.name,
          format(item.expiryDate.toDate(), 'yyyy-MM-dd'),
          `Periodic system check. Current days left: ${days}`
        );
        
        await updateDoc(doc(db, 'users', user.uid, 'inventory', item.id), {
          expiryDate: Timestamp.fromDate(addDays(new Date(), result.updated_shelf_life_days))
        });
        updatedCount++;
      }
      setLastAction(`Recalculated ${updatedCount} items.`);
      toast.success(`Recalculated ${updatedCount} items.`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to recalculate expiry dates.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsAdding(true);
    setLastAction(`Processing [${file.name}]...`);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const extracted = await geminiService.extractFoodData({ image: base64 }, format(new Date(), 'yyyy-MM-dd'));
        
        if (extracted.length === 0) {
          setLastAction('No food items found in image.');
          toast.error('No food items detected. Try a clearer photo.');
          return;
        }

        for (const item of extracted) {
          await addDoc(collection(db, 'users', user.uid, 'inventory'), {
            name: item.item_name,
            category: item.category_tag,
            expiryDate: Timestamp.fromDate(addDays(new Date(), item.predicted_shelf_life_days)),
            addedAt: serverTimestamp(),
            storageCondition: 'fridge',
            quantity: '1 unit'
          });
        }
        setLastAction(`Extracted: "${extracted.map(i => i.item_name).join(', ')}"`);
        toast.success(`Added ${extracted.length} items!`);
      } catch (error) {
        console.error(error);
        setLastAction('Extraction failed.');
        toast.error('Failed to extract food data.');
      } finally {
        setIsAdding(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'inventory', id));
      toast.success('Item removed.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/inventory/${id}`);
    }
  };

  const handleUpdateDate = async (id: string, newDate: string) => {
    if (!user || !newDate) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'inventory', id), {
        expiryDate: Timestamp.fromDate(new Date(newDate))
      });
      toast.success('Expiry date updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/inventory/${id}`);
    }
  };

  const handleUpdateCategory = async (id: string, newCategory: string) => {
    if (!user || !newCategory) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'inventory', id), {
        category: newCategory
      });
      toast.success('Category updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/inventory/${id}`);
    }
  };

  const handleLogAction = async (item: FoodItem, action: "consumed_privately" | "shared_recipe_online" | "shared_physically") => {
    if (!user) return;
    
    try {
      const daysRemaining = differenceInDays(item.expiryDate.toDate(), new Date());
      const pointResult = await geminiService.calculatePoints({
        items: [item.name],
        category: item.category,
        originalShelfLife: 7, // Default assumption or we could track this
        daysRemaining,
        actionTaken: action
      });

      // Update user points
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        points: increment(pointResult.points_awarded)
      });

      // If shared physically, create a community post
      if (action === "shared_physically") {
        const listing = await geminiService.generateSharingListing({
          description: `Fresh ${item.name}`,
          daysToExpiry: daysRemaining,
          location: "Neighborhood Hub"
        });

        await addDoc(collection(db, 'community_posts'), {
          userId: user.uid,
          userEmail: user.email || null,
          title: listing.listing_title,
          description: listing.listing_description,
          tags: listing.suggested_tags,
          createdAt: serverTimestamp(),
          item_name: item.name,
          days_left: daysRemaining
        });
      }

      // Remove item from inventory
      await deleteDoc(doc(db, 'users', user.uid, 'inventory', item.id));

      toast.success(pointResult.celebratory_message);
      setLastAction(`Awarded ${pointResult.points_awarded} points for ${action.replace('_', ' ')}!`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to log action.');
    }
  };

  const handleUpdateStorage = async (item: FoodItem, newCondition: 'fridge' | 'freezer' | 'pantry') => {
    if (!user) return;
    try {
      const result = await geminiService.recalculateExpiry(
        item.name, 
        format(item.expiryDate.toDate(), 'yyyy-MM-dd'), 
        `Moved to ${newCondition}`
      );
      
      await updateDoc(doc(db, 'users', user.uid, 'inventory', item.id), {
        storageCondition: newCondition,
        expiryDate: Timestamp.fromDate(addDays(new Date(), result.updated_shelf_life_days))
      });
      
      setLastAction(`Recalibrated: ${item.name} (+${result.updated_shelf_life_days} days)`);
      toast.info(result.reasoning);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update storage.');
    }
  };

  const generateRecipe = async () => {
    if (!user || inventory.length === 0) return;
    setIsGeneratingRecipe(true);
    try {
      const invData = inventory.map(i => ({
        name: i.name,
        days_until_expiry: differenceInDays(i.expiryDate.toDate(), new Date())
      }));
      const newRecipe = await geminiService.generateRecipe(invData);
      setRecipe(newRecipe);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate recipe.');
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg"><RefreshCw className="animate-spin text-accent" /></div>;
  if (!user) return <AuthScreen />;

  const filteredInventory = inventory
    .filter(item => {
      const days = differenceInDays(item.expiryDate.toDate(), new Date());
      let status = 'stable';
      if (isPast(item.expiryDate.toDate())) status = 'expired';
      else if (days <= 2) status = 'urgent';
      else if (days <= 30) status = 'fresh';

      const matchesTab = activeTab === 'all' || item.storageCondition === activeTab;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      return matchesTab && matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      const daysA = differenceInDays(a.expiryDate.toDate(), new Date());
      const daysB = differenceInDays(b.expiryDate.toDate(), new Date());
      return sortOrder === 'asc' ? daysA - daysB : daysB - daysA;
    });

  const expiringSoonCount = inventory.filter(i => differenceInDays(i.expiryDate.toDate(), new Date()) <= 2).length;
  const criticalCount = inventory.filter(i => differenceInDays(i.expiryDate.toDate(), new Date()) <= 1).length;

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white border-b border-border px-5 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-8">
          <div className="font-bold tracking-tight text-lg flex items-center gap-2" style={{ color: '#284134' }}>
            Vegie365 <span className="bg-[#284134] text-white px-1.5 py-0.5 rounded text-[10px] font-mono">v2.1-AI</span>
          </div>

          <nav className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentView('inventory')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${currentView === 'inventory' ? 'bg-[#284134] text-white' : 'text-muted-foreground hover:text-ink hover:bg-bg'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setCurrentView('community')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${currentView === 'community' ? 'bg-[#284134] text-white' : 'text-muted-foreground hover:text-ink hover:bg-bg'}`}
            >
              Community
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-muted-foreground text-[11px] hidden md:block">
            {inventory.length} Items Tracked &nbsp; | &nbsp; {user.email}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-ink">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {currentView === 'inventory' ? (
          <div className="h-full grid grid-cols-[240px_1fr_320px] overflow-hidden">
            {/* Sidebar */}
            <aside className="border-r border-border bg-[#f9fafb] p-4 flex flex-col gap-6 overflow-y-auto">
              <div>
                <p className="section-label">Storage Zones</p>
                <div className={`nav-item cursor-pointer text-ink ${activeTab === 'all' ? 'active' : ''}`} onClick={() => { setActiveTab('all'); }}>
                  <span>All Items</span> <span>{inventory.length}</span>
                </div>
                <div className={`nav-item cursor-pointer ${activeTab === 'fridge' ? 'active' : ''}`} onClick={() => { setActiveTab('fridge'); }}>
                  <span>Main Refrigerator</span> <span>{inventory.filter(i => i.storageCondition === 'fridge').length}</span>
                </div>
                <div className={`nav-item cursor-pointer ${activeTab === 'freezer' ? 'active' : ''}`} onClick={() => { setActiveTab('freezer'); }}>
                  <span>Freezer</span> <span>{inventory.filter(i => i.storageCondition === 'freezer').length}</span>
                </div>
                <div className={`nav-item cursor-pointer ${activeTab === 'pantry' ? 'active' : ''}`} onClick={() => { setActiveTab('pantry'); }}>
                  <span>Dry Pantry</span> <span>{inventory.filter(i => i.storageCondition === 'pantry').length}</span>
                </div>
              </div>

              <div>
                <p className="section-label">Alerts</p>
                <div className="nav-item">
                  <span className="text-warn">Critical (&lt; 2 days)</span> <span>{expiringSoonCount}</span>
                </div>
                <div className="nav-item">
                  <span className="text-ink">Expiring Soon (&lt; 5 days)</span> <span>{inventory.filter(i => differenceInDays(i.expiryDate.toDate(), new Date()) <= 5).length}</span>
                </div>
              </div>

              <div>
                <p className="section-label">Legend</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="status-pill status-expiring w-16 text-center">URGENT</span>
                    <span className="text-muted-foreground">Within 2 days</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="status-pill status-fresh w-16 text-center">FRESH</span>
                    <span className="text-muted-foreground">2 days to 1 month</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="status-pill status-stable w-16 text-center">STABLE</span>
                    <span className="text-muted-foreground">Over 1 month</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-4">
                <div className="bg-[#284134]/5 p-3 rounded-lg border border-[#284134]/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-[#284134]">Your Impact</span>
                    <Trophy className="w-3 h-3 text-[#284134]" />
                  </div>
                  <div className="text-xl font-bold text-ink">{userPoints} pts</div>
                  <div className="text-[10px] text-muted-foreground">Zero Waste Score</div>
                </div>
                <div className="ai-bubble text-[11px] mt-0">
                  <strong>Storage Tip:</strong> {storageTips[currentTipIndex]}
                </div>
              </div>
            </aside>

            {/* Inventory Container */}
            <section className="bg-white flex flex-col overflow-hidden">
              <div className="p-4 border-b border-border flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input 
                placeholder="Filter inventory..." 
                className="pl-9 bg-bg border-none h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAdding}
              size="sm"
              className="bg-ink hover:bg-zinc-800 text-white h-9 px-4"
            >
              {isAdding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
              Scan
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#f9fafb] sticky top-0 z-10">
                <tr>
                  <th className="text-[10px] uppercase text-muted-foreground p-3 px-4 border-b border-border font-semibold">Item Name</th>
                  <th className="text-[10px] uppercase text-muted-foreground p-3 px-4 border-b border-border font-semibold">
                    <div className="flex items-center gap-1">
                      Category
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-5 w-5 p-0 border-none bg-transparent shadow-none focus:ring-0">
                          <Search className="w-3 h-3" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="Vegetable">Vegetable</SelectItem>
                          <SelectItem value="Fruit">Fruit</SelectItem>
                          <SelectItem value="Dairy">Dairy</SelectItem>
                          <SelectItem value="Meat">Meat</SelectItem>
                          <SelectItem value="Bakery">Bakery</SelectItem>
                          <SelectItem value="Condiment">Condiment</SelectItem>
                          <SelectItem value="Beverage">Beverage</SelectItem>
                          <SelectItem value="Snack">Snack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </th>
                  <th className="text-[10px] uppercase text-muted-foreground p-3 px-4 border-b border-border font-semibold">
                    <div className="flex items-center gap-1">
                      Status
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-5 w-5 p-0 border-none bg-transparent shadow-none focus:ring-0">
                          <Search className="w-3 h-3" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="fresh">Fresh</SelectItem>
                          <SelectItem value="stable">Stable</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </th>
                  <th className="text-[10px] uppercase text-muted-foreground p-3 px-4 border-b border-border font-semibold">
                    <button 
                      className="flex items-center gap-1 hover:text-ink transition-colors"
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    >
                      Days Left
                      <Clock className={`w-3 h-3 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                    </button>
                  </th>
                  <th className="text-[10px] uppercase text-muted-foreground p-3 px-4 border-b border-border font-semibold">
                    <div className="flex items-center gap-2">
                      Location
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleRemoveAll}
                        disabled={inventory.length === 0 || isDeletingAll}
                        className="h-6 text-[9px] text-warn hover:bg-red-50 px-1.5"
                      >
                        {isDeletingAll ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Remove All'}
                      </Button>
                    </div>
                  </th>
                  <th className="text-[10px] uppercase text-muted-foreground p-3 px-4 border-b border-border font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredInventory.map((item) => {
                    const days = differenceInDays(item.expiryDate.toDate(), new Date());
                    const isUrgent = days <= 2;
                    const isFresh = days > 2 && days <= 30;
                    const isStable = days > 30;
                    
                    return (
                      <motion.tr 
                        key={item.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-bg/50 transition-colors"
                      >
                        <td className="p-3 px-4 border-b border-bg align-middle">
                          <div className="font-bold text-ink">{item.name}</div>
                        </td>
                        <td className="p-3 px-4 border-b border-bg align-middle">
                          <Select 
                            value={item.category} 
                            onValueChange={(val) => handleUpdateCategory(item.id, val)}
                          >
                            <SelectTrigger className="h-7 w-24 text-[10px] bg-bg border-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Vegetable">Vegetable</SelectItem>
                              <SelectItem value="Fruit">Fruit</SelectItem>
                              <SelectItem value="Dairy">Dairy</SelectItem>
                              <SelectItem value="Meat">Meat</SelectItem>
                              <SelectItem value="Bakery">Bakery</SelectItem>
                              <SelectItem value="Condiment">Condiment</SelectItem>
                              <SelectItem value="Beverage">Beverage</SelectItem>
                              <SelectItem value="Snack">Snack</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 px-4 border-b border-bg align-middle">
                          <span className={`status-pill ${isUrgent ? 'status-expiring' : isFresh ? 'status-fresh' : 'status-stable'}`}>
                            {isUrgent ? 'URGENT' : isFresh ? 'FRESH' : 'STABLE'}
                          </span>
                        </td>
                        <td className={`p-3 px-4 border-b border-bg align-middle font-mono font-bold ${isUrgent ? 'text-warn' : ''}`}>
                          <div className="flex flex-col gap-1">
                            <span>{days < 0 ? 'Expired' : `${days} Day${days !== 1 ? 's' : ''}`}</span>
                            <input 
                              type="date" 
                              className="bg-transparent border-none text-[10px] text-muted-foreground focus:ring-0 cursor-pointer w-full p-0"
                              value={format(item.expiryDate.toDate(), 'yyyy-MM-dd')}
                              onChange={(e) => handleUpdateDate(item.id, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="p-3 px-4 border-b border-bg align-middle">
                          <div className="flex items-center gap-2">
                            <Select 
                              value={item.storageCondition} 
                              onValueChange={(val: any) => handleUpdateStorage(item, val)}
                            >
                              <SelectTrigger className="h-7 w-20 text-[10px] bg-bg border-none capitalize">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fridge" className="capitalize">Fridge</SelectItem>
                                <SelectItem value="freezer" className="capitalize">Freezer</SelectItem>
                                <SelectItem value="pantry" className="capitalize">Pantry</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                        <td className="p-3 px-4 border-b border-bg align-middle text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-accent" />}>
                                <CheckCircle2 className="w-4 h-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Log Action</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleLogAction(item, 'consumed_privately')}>
                                    Consumed Privately (1x)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleLogAction(item, 'shared_recipe_online')}>
                                    Shared Recipe Online (1.5x)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleLogAction(item, 'shared_physically')}>
                                    Shared Physically (2x)
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(item.id)}
                              className="h-8 w-8 text-warn hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
            {filteredInventory.length === 0 && (
              <div className="p-20 text-center text-muted-foreground">No items found in this zone.</div>
            )}
            </ScrollArea>
          </div>
        </section>

            {/* Insight Panel */}
            <aside className="border-l border-border bg-white flex flex-col h-full overflow-hidden">
              <div className="bg-ink text-white p-5 h-[180px] shrink-0">
                <p className="section-label" style={{ color: '#e5e5e5' }}>Task Engine: Extraction</p>
                <div className="console-line" style={{ color: '#e5e5e5' }}>&gt; Listening for input...</div>
                {lastAction && <div className="console-line" style={{ color: '#e5e5e5' }}>&gt; {lastAction}</div>}
                {isAdding && <div className="console-line success animate-pulse">&gt; Processing...</div>}
                <div className="console-line" style={{ color: '#e5e5e5' }}>_</div>
              </div>

              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-4 border-b border-border">
                  <div className="flex justify-between items-center mb-4">
                    <p className="section-label mb-0">Suggested Recipe</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={generateRecipe} 
                      disabled={isGeneratingRecipe || inventory.length === 0}
                      className="h-7 text-[10px] px-2"
                    >
                      {isGeneratingRecipe ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ChefHat className="w-3 h-3 mr-1" />}
                      Regenerate
                    </Button>
                  </div>
                  
                  {recipe ? (
                    <div className="space-y-3">
                      <h3 className="font-serif italic text-lg text-ink leading-tight">{recipe.recipe_name}</h3>
                      <ul className="space-y-1.5 text-[12px] leading-relaxed">
                        {recipe.priority_ingredients_used.map(ing => (
                          <li key={ing} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-warn rounded-full"></span>
                            <strong>{ing}</strong> <span className="text-muted-foreground text-[10px]">(Expiring)</span>
                          </li>
                        ))}
                        {recipe.other_ingredients_used.map(ing => (
                          <li key={ing} className="flex items-center gap-2">
                            <span className="text-muted-foreground">—</span> {ing}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 text-[11px] text-muted-foreground leading-relaxed space-y-2">
                        {recipe.instructions.map((step, i) => (
                          <div key={i}>{i + 1}. {step}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-xs italic">
                      No recipe generated. Add items to see suggestions.
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="section-label mb-0">Recalculate Expiry</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRecalculateAll}
                      disabled={isRecalculating || inventory.length === 0}
                      className="h-7 text-[10px] px-2"
                    >
                      {isRecalculating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Recalculate All
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px]"><strong>Action:</strong> Storage calibration active.</div>
                    <div className="ai-bubble mt-0 text-[11px] bg-green-50 border-green-100">
                      <strong>Update:</strong> Moving items to freezer extends life by 3-6 months based on moisture content.
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </aside>
        </div>
        ) : (
          <div className="h-full flex overflow-hidden">
            {/* Community Sidebar */}
            <aside className="w-[240px] border-r border-border bg-[#f9fafb] p-4 flex flex-col gap-6 overflow-y-auto">
              <div className="bg-[#284134]/5 p-3 rounded-lg border border-[#284134]/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-[#284134]">Your Impact</span>
                  <Trophy className="w-3 h-3 text-[#284134]" />
                </div>
                <div className="text-xl font-bold text-ink">{userPoints} pts</div>
                <div className="text-[10px] text-muted-foreground">Zero Waste Score</div>
              </div>

              <div>
                <p className="section-label">Zero Waste Leaderboard</p>
                <div className="space-y-3">
                  {leaderboard.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">No entries yet...</p>
                  ) : (
                    leaderboard.map((entry, index) => (
                      <div key={entry.id} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                            index === 1 ? 'bg-slate-100 text-slate-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-bg text-muted-foreground'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="font-medium truncate max-w-[100px]">{entry.displayName}</span>
                        </div>
                        <span className="font-bold text-accent">{entry.points}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="section-label">Community Stats</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Active Listings</span>
                    <span className="font-bold">{communityPosts.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Items Saved Today</span>
                    <span className="font-bold">12</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* Community Feed */}
            <section className="flex-1 bg-white flex flex-col overflow-hidden">
              <div className="p-6 border-b border-border bg-[#f9fafb] flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-ink mb-1">Neighborhood Sharing Feed</h2>
                  <p className="text-sm text-muted-foreground">Help your neighbors and earn Zero Waste points!</p>
                </div>
                <Dialog>
                  <DialogTrigger render={<Button className="bg-[#284134] hover:bg-[#284134]/90 text-white gap-2">
                    <ChefHat className="w-4 h-4" />
                    Share a Recipe
                  </Button>} />
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Share Your Zero-Waste Creation</DialogTitle>
                      <DialogDescription>
                        Upload a photo and details of your dish. We'll standardize it and help you track your impact.
                      </DialogDescription>
                    </DialogHeader>
                    
                    {!processedRecipe ? (
                      <form onSubmit={handleProcessCommunityRecipe} className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Dish Photo</Label>
                          <div 
                            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-bg transition-colors"
                            onClick={() => (document.getElementById('recipe-image') as HTMLInputElement)?.click()}
                          >
                            <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Click to upload final dish</p>
                            <input id="recipe-image" type="file" accept="image/*" className="hidden" />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Ingredients Used</Label>
                          <textarea 
                            name="ingredients"
                            required
                            placeholder="e.g. 2 old carrots, half a bag of spinach, 1 cup rice..."
                            className="w-full min-h-[100px] p-3 rounded-lg border border-input text-sm focus:ring-2 focus:ring-[#284134] outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold text-muted-foreground">Cooking Steps</Label>
                          <textarea 
                            name="steps"
                            required
                            placeholder="e.g. Chop carrots, sauté with spinach, mix with cooked rice..."
                            className="w-full min-h-[100px] p-3 rounded-lg border border-input text-sm focus:ring-2 focus:ring-[#284134] outline-none"
                          />
                        </div>

                        <Button 
                          type="submit" 
                          disabled={isProcessingRecipe}
                          className="w-full bg-[#284134] hover:bg-[#284134]/90 text-white h-12"
                        >
                          {isProcessingRecipe ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ChefHat className="w-4 h-4 mr-2" />}
                          Process with AI Intelligence
                        </Button>
                      </form>
                    ) : (
                      <div className="space-y-6 py-4">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-emerald-900">{processedRecipe.formatted_recipe.recipe_title}</h3>
                            <Badge className="bg-emerald-600 text-white border-none">
                              Saved S${processedRecipe.estimated_savings_sgd.toFixed(2)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {processedRecipe.suggested_tags.map(tag => (
                              <span key={tag} className="text-[10px] bg-white/50 px-2 py-0.5 rounded-full text-emerald-700 border border-emerald-200">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-xs uppercase font-bold text-muted-foreground mb-2">Standardized Ingredients</h4>
                            <ul className="text-sm space-y-1">
                              {processedRecipe.formatted_recipe.standardized_ingredients_original_yield.map((ing, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-emerald-500 mt-1">•</span> {ing}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs uppercase font-bold text-muted-foreground mb-2">Single Serving Scale</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              {processedRecipe.formatted_recipe.standardized_ingredients_single_serving.map((ing, i) => (
                                <li key={i}>{ing}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs uppercase font-bold text-muted-foreground mb-2">Instructions</h4>
                          <ol className="text-sm space-y-2">
                            {processedRecipe.formatted_recipe.formatted_steps.map((step, i) => (
                              <li key={i} className="flex gap-3">
                                <span className="font-bold text-muted-foreground">{i + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div className="pt-4 border-t border-border">
                          <p className="text-sm font-medium mb-3">Confirm items used from your inventory:</p>
                          <div className="flex flex-wrap gap-2 mb-6">
                            {processedRecipe.items_to_deplete.map(item => (
                              <Badge key={item} variant="outline" className="bg-bg text-ink border-border px-3 py-1">
                                {item}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-3">
                            <Button 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => setProcessedRecipe(null)}
                            >
                              Edit Recipe
                            </Button>
                            <Button 
                              className="flex-1 bg-[#284134] hover:bg-[#284134]/90 text-white"
                              onClick={() => handleConfirmDepletion(processedRecipe.items_to_deplete)}
                            >
                              Confirm & Log Impact
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  {communityPosts.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                      <p className="text-muted-foreground">No active listings in your area. Be the first to share!</p>
                    </div>
                  ) : (
                    communityPosts.map((post) => (
                      <motion.div 
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg text-ink">{post.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span className="font-medium text-accent">{post.userEmail?.split('@')[0] || 'Anonymous'}</span>
                              <span>•</span>
                              <span>{post.createdAt?.toDate().toLocaleDateString()}</span>
                            </div>
                          </div>
                          <span className={`status-pill ${post.days_left <= 1 ? 'status-expiring' : 'status-fresh'}`}>
                            {post.days_left} Days Left
                          </span>
                        </div>
                        <p className="text-sm text-ink/80 mb-4 leading-relaxed">
                          {post.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {post.tags?.map((tag: string) => (
                            <span key={tag} className="text-[10px] bg-bg px-2 py-0.5 rounded-full text-muted-foreground border border-border">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <Button 
                          className="w-full bg-[#284134] hover:bg-[#284134]/90 text-white gap-2"
                          onClick={() => toast.success(`Interest sent to ${post.userEmail?.split('@')[0]}!`)}
                        >
                          <Share2 className="w-4 h-4" />
                          I'm Interested
                        </Button>
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </section>
          </div>
        )}
      </main>

      {/* Manual Add Button */}
      <Dialog>
        <DialogTrigger render={<Button className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-ink hover:bg-zinc-800 text-white shadow-xl" />}>
          <Plus className="w-6 h-6" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Manual Entry</DialogTitle>
          </DialogHeader>
          <form className="space-y-4 py-2" onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name') as string;
            const category = formData.get('category') as string;
            const expiryDateStr = formData.get('expiryDate') as string;
            const storageCondition = formData.get('storageCondition') as 'fridge' | 'freezer' | 'pantry';
            
            if (!user || !name || !category || !expiryDateStr) return;
            
            try {
              await addDoc(collection(db, 'users', user.uid, 'inventory'), {
                name,
                category,
                expiryDate: Timestamp.fromDate(new Date(expiryDateStr)),
                addedAt: serverTimestamp(),
                storageCondition,
                quantity: '1 unit'
              });
              toast.success('Item added!');
              (e.target as HTMLFormElement).reset();
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/inventory`);
            }
          }}>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[11px] uppercase text-muted-foreground px-2.5">Item Name</Label>
              <Input id="name" name="name" placeholder="e.g. Milk" required className="h-9 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-[11px] uppercase text-muted-foreground px-2.5">Category</Label>
                <Select name="category" defaultValue="Vegetable">
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vegetable">Vegetable</SelectItem>
                    <SelectItem value="Fruit">Fruit</SelectItem>
                    <SelectItem value="Dairy">Dairy</SelectItem>
                    <SelectItem value="Meat">Meat</SelectItem>
                    <SelectItem value="Bakery">Bakery</SelectItem>
                    <SelectItem value="Condiment">Condiment</SelectItem>
                    <SelectItem value="Beverage">Beverage</SelectItem>
                    <SelectItem value="Snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="storageCondition" className="text-[11px] uppercase text-muted-foreground px-2.5">Location</Label>
                <Select name="storageCondition" defaultValue="fridge">
                  <SelectTrigger className="h-9 text-xs capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fridge" className="capitalize">Fridge</SelectItem>
                    <SelectItem value="freezer" className="capitalize">Freezer</SelectItem>
                    <SelectItem value="pantry" className="capitalize">Pantry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiryDate" className="text-[11px] uppercase text-muted-foreground px-2.5">Days Left (Expiry Date)</Label>
              <Input id="expiryDate" name="expiryDate" type="date" defaultValue={format(addDays(new Date(), 7), 'yyyy-MM-dd')} required className="h-9 text-xs" />
            </div>
            <Button type="submit" className="w-full bg-ink hover:bg-zinc-800 text-white h-10">Add to Inventory</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
