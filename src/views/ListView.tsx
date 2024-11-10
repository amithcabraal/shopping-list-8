import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { WeeklyShop, Product } from '../types';
import { Search, Plus, ShoppingCart, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { ShoppingList } from '../components/ShoppingList';
import { VoiceSearch } from '../components/VoiceSearch';
import debounce from 'lodash/debounce';

const ListView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentShop, setCurrentShop] = useState<WeeklyShop | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCurrentShop();
  }, []);

  // Initialize quantities when search results change
  useEffect(() => {
    const initialQuantities = searchResults.reduce((acc, product) => ({
      ...acc,
      [product.id]: product.default_quantity || 1
    }), {});
    setQuantities(initialQuantities);
  }, [searchResults]);

  const fetchCurrentShop = async () => {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: shopData, error } = await supabase
      .from('weekly_shops')
      .select(`
        *,
        items:weekly_shop_items(
          *,
          product:products(
            *,
            location:store_locations(*)
          )
        )
      `)
      .gte('shop_date', startOfWeek.toISOString())
      .order('shop_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      toast.error('Error fetching current shop');
      return;
    }

    setCurrentShop(shopData);
    setLoading(false);
  };

  const performSearch = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const { data, error } = await supabase
      .rpc('search_products', { search_term: term })
      .select(`
        *,
        location:store_locations(*)
      `);

    if (error) {
      toast.error('Error searching products');
      setSearching(false);
      return;
    }

    setSearchResults(data || []);
    setSearching(false);
  };

  // Debounced search function for typing
  const debouncedSearch = useCallback(
    debounce((term: string) => performSearch(term), 300),
    []
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTerm = e.target.value;
    setSearchTerm(newTerm);
    debouncedSearch(newTerm);
  };

  // Handle voice search result
  const handleVoiceResult = (text: string) => {
    setSearchTerm(text);
    performSearch(text);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const addToList = async (product: Product) => {
    if (!currentShop) {
      const { data: newShop, error: createError } = await supabase
        .from('weekly_shops')
        .insert([{ shop_date: new Date().toISOString() }])
        .select()
        .single();

      if (createError) {
        toast.error('Error creating new list');
        return;
      }

      setCurrentShop({ ...newShop, items: [] });
    }

    const { error } = await supabase
      .from('weekly_shop_items')
      .insert([{
        weekly_shop_id: currentShop?.id,
        product_id: product.id,
        quantity: quantities[product.id] || 1,
        status: 'required'
      }]);

    if (error) {
      if (error.code === '23505') {
        toast.error('Product already in list');
      } else {
        toast.error('Error adding product to list');
      }
      return;
    }

    toast.success('Added to list');
    fetchCurrentShop();
    setSearchResults([]);
    setSearchTerm('');
  };

  const createNewList = async () => {
    const { data: newShop, error } = await supabase
      .from('weekly_shops')
      .insert([{ shop_date: new Date().toISOString() }])
      .select()
      .single();

    if (error) {
      toast.error('Error creating new list');
      return;
    }

    setCurrentShop({ ...newShop, items: [] });
    toast.success('New shopping list created');
  };

  if (loading) {
    return (
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!currentShop ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-medium mb-2 text-gray-900 dark:text-gray-100">No Shopping List for This Week</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Would you like to create a new shopping list?
          </p>
          <button
            onClick={createNewList}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create New List
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Search products..."
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <VoiceSearch 
                  onResult={handleVoiceResult}
                  disabled={searching}
                />
              </div>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Search Results</h3>
              <div className="space-y-2">
                {searchResults.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{product.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {product.location?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-2">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-gray-900 dark:text-gray-100">
                          {quantities[product.id] || 1}
                        </span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => addToList(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current List */}
          {currentShop.items && currentShop.items.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Current List</h3>
              <ShoppingList 
                items={currentShop.items} 
                viewMode="list" 
                onItemRemoved={(itemId) => {
                  setCurrentShop(prev => prev ? {
                    ...prev,
                    items: prev.items.filter(item => item.id !== itemId)
                  } : null);
                }}
                onQuantityChanged={(itemId, newQuantity) => {
                  setCurrentShop(prev => prev ? {
                    ...prev,
                    items: prev.items.map(item => 
                      item.id === itemId ? { ...item, quantity: newQuantity } : item
                    )
                  } : null);
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ListView;