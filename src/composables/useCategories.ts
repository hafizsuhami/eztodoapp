import { ref, watch } from 'vue';
import { supabase } from '../services/supabase';
import type { CategoryOption } from '../types';
import { DEFAULT_CATEGORIES, PASTEL_COLORS } from '../constants';

const CATEGORIES_CACHE_KEY = 'taskmaster_categories_cache';

export function useCategories(userId: () => string | undefined) {
  const categories = ref<CategoryOption[]>([]);
  const loading = ref(true);

  const getCachedCategories = (): CategoryOption[] => {
    try {
      const cached = localStorage.getItem(CATEGORIES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  };

  const setCachedCategories = (cats: CategoryOption[]): void => {
    try {
      localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cats));
    } catch (e) {
      console.error('Failed to cache categories:', e);
    }
  };

  const fetchCategories = async () => {
    const id = userId();
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        categories.value = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          color: c.color
        }));
      } else {
        // Seed default categories for new user
        await seedDefaultCategories(id);
      }

      setCachedCategories(categories.value);
    } catch (e) {
      console.error('Failed to fetch categories:', e);
      const cached = getCachedCategories();
      if (cached.length > 0) {
        categories.value = cached;
      } else {
        categories.value = DEFAULT_CATEGORIES;
      }
    } finally {
      loading.value = false;
    }
  };

  const seedDefaultCategories = async (uid: string) => {
    // Don't include custom string IDs - let Supabase auto-generate UUIDs
    const toInsert = DEFAULT_CATEGORIES.map(c => ({
      user_id: uid,
      name: c.name,
      color: c.color
    }));

    const { data, error } = await supabase
      .from('categories')
      .insert(toInsert)
      .select();

    if (error) {
      console.error('Failed to seed categories:', error);
      categories.value = DEFAULT_CATEGORIES;
    } else if (data) {
      categories.value = data.map((c: any) => ({
        id: c.id,
        name: c.name,
        color: c.color
      }));
    }
  };

  const createCategory = async (name: string, color: string) => {
    const id = userId();
    if (!id) return;

    const tempId = 'cat-' + Date.now().toString();
    const newCat: CategoryOption = { id: tempId, name, color };

    categories.value = [...categories.value, newCat];
    setCachedCategories(categories.value);

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: id, name, color })
        .select()
        .single();

      if (error) throw error;

      categories.value = categories.value.map(c =>
        c.id === tempId ? { id: data.id, name: data.name, color: data.color } : c
      );
      setCachedCategories(categories.value);
    } catch (e) {
      console.error('Failed to create category:', e);
    }
  };

  const updateCategory = async (catId: string, updates: { name?: string; color?: string }) => {
    categories.value = categories.value.map(c =>
      c.id === catId ? { ...c, ...updates } : c
    );
    setCachedCategories(categories.value);

    try {
      const { error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', catId);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to update category:', e);
    }
  };

  const deleteCategory = async (catId: string) => {
    categories.value = categories.value.filter(c => c.id !== catId);
    setCachedCategories(categories.value);

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', catId);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to delete category:', e);
    }
  };

  const getCategoryById = (catId: string): CategoryOption | undefined => {
    return categories.value.find(c => c.id === catId);
  };

  const getCategoryByName = (name: string): CategoryOption | undefined => {
    return categories.value.find(c => c.name.toLowerCase() === name.toLowerCase());
  };

  watch(userId, (newId) => {
    if (newId) {
      const cached = getCachedCategories();
      if (cached.length > 0) {
        categories.value = cached;
      }
      fetchCategories();
    } else {
      loading.value = false;
    }
  }, { immediate: true });

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getCategoryByName,
    refetch: fetchCategories,
    PASTEL_COLORS
  };
}
