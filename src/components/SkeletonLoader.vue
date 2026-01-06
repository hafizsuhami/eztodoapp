<script setup lang="ts">
/**
 * SkeletonLoader - Loading placeholder with pulse animation
 * Provides visual feedback during async operations
 */
defineProps<{
  variant?: 'task' | 'category' | 'text' | 'avatar';
  count?: number;
  className?: string;
}>();
</script>

<template>
  <!-- Task skeleton -->
  <div v-if="variant === 'task' || !variant" class="space-y-3">
    <div
      v-for="i in (count || 3)"
      :key="i"
      class="flex items-start gap-4 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-skeleton"
      :style="{ animationDelay: `${i * 100}ms` }"
    >
      <!-- Checkbox skeleton -->
      <div class="size-5 rounded-md bg-slate-200 dark:bg-slate-700 shrink-0 mt-0.5" />

      <!-- Content skeleton -->
      <div class="flex-1 space-y-2.5">
        <!-- Title -->
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4" />

        <!-- Badges row -->
        <div class="flex items-center gap-2">
          <div class="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-16" />
          <div class="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-20" />
        </div>
      </div>

      <!-- Action button skeleton -->
      <div class="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
    </div>
  </div>

  <!-- Category skeleton -->
  <div v-else-if="variant === 'category'" class="flex flex-wrap gap-2">
    <div
      v-for="i in (count || 4)"
      :key="i"
      class="h-8 rounded-full bg-slate-200 dark:bg-slate-700 animate-skeleton"
      :class="[
        i === 1 ? 'w-16' : i === 2 ? 'w-20' : i === 3 ? 'w-14' : 'w-18'
      ]"
      :style="{ animationDelay: `${i * 75}ms` }"
    />
  </div>

  <!-- Text skeleton -->
  <div v-else-if="variant === 'text'" :class="className">
    <div
      v-for="i in (count || 2)"
      :key="i"
      class="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-skeleton mb-2"
      :class="i === count || i === 2 ? 'w-2/3' : 'w-full'"
      :style="{ animationDelay: `${i * 100}ms` }"
    />
  </div>

  <!-- Avatar skeleton -->
  <div v-else-if="variant === 'avatar'" class="flex items-center gap-3">
    <div class="size-10 rounded-full bg-slate-200 dark:bg-slate-700 animate-skeleton" />
    <div class="space-y-2">
      <div class="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-skeleton" />
      <div class="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-skeleton" style="animation-delay: 100ms" />
    </div>
  </div>
</template>
