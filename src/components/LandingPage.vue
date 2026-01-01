<script setup lang="ts">
defineEmits<{
  getStarted: [];
}>();
</script>

<template>
  <div class="min-h-screen bg-amber-50 dark:bg-slate-900 overflow-hidden">
    
    <!-- Fun background shapes -->
    <div class="absolute top-20 left-10 w-20 h-20 bg-rose-300 dark:bg-rose-500/30 rounded-full blur-sm opacity-60"></div>
    <div class="absolute top-40 right-20 w-14 h-14 bg-sky-300 dark:bg-sky-500/30 rounded-lg rotate-12 opacity-60"></div>
    <div class="absolute bottom-40 left-1/4 w-16 h-16 bg-emerald-300 dark:bg-emerald-500/30 rounded-full opacity-50"></div>
    <div class="absolute top-1/3 right-1/4 w-10 h-10 bg-amber-300 dark:bg-amber-500/30 rounded-lg rotate-45 opacity-60"></div>

    <!-- Header -->
    <header class="relative z-10 flex items-center justify-between px-6 py-5 md:px-12 md:py-6 max-w-6xl mx-auto">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center rotate-3 shadow-lg shadow-rose-500/30">
          <span class="material-symbols-outlined text-white text-2xl" style="font-variation-settings: 'FILL' 1;">task_alt</span>
        </div>
        <span class="text-xl font-bold text-slate-800 dark:text-white">
          EZtodo
        </span>
      </div>
      <button
        @click="$emit('getStarted')"
        class="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
      >
        Sign in
      </button>
    </header>

    <!-- Hero Section -->
    <main class="relative z-10 flex flex-col items-center px-6 pt-12 pb-20 md:pt-20 md:pb-32 max-w-6xl mx-auto">
      
      <!-- Fun badge -->
      <div class="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-md mb-8 -rotate-1">
        <span class="text-xl">✨</span>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Finally, a todo app you'll actually like</span>
      </div>

      <!-- Headline -->
      <h1 class="text-4xl md:text-6xl lg:text-7xl font-black text-center leading-[1.1] tracking-tight max-w-4xl mb-6">
        <span class="text-slate-800 dark:text-white">Get stuff done,</span>
        <br />
        <span class="relative inline-block">
          <span class="relative z-10 text-slate-800 dark:text-white">feel good</span>
          <svg class="absolute -bottom-2 left-0 w-full h-4 text-rose-400 dark:text-rose-500" viewBox="0 0 200 12" preserveAspectRatio="none">
            <path d="M0,8 Q50,0 100,8 T200,8" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="inline-block ml-3 text-4xl md:text-6xl lg:text-7xl animate-bounce">🎉</span>
      </h1>

      <!-- Subheadline -->
      <p class="text-lg md:text-xl text-slate-600 dark:text-slate-400 text-center max-w-lg mb-10 leading-relaxed">
        A friendly little app that helps you stay on top of things. 
        No stress, just checkboxes.
      </p>

      <!-- CTA Button -->
      <div class="flex flex-col items-center gap-4 mb-16">
        <button
          @click="$emit('getStarted')"
          class="group px-8 py-4 bg-rose-500 hover:bg-rose-600 text-white text-lg font-bold rounded-2xl shadow-xl shadow-rose-500/30 hover:shadow-rose-500/40 transition-all hover:scale-105 hover:-rotate-1 active:scale-100"
        >
          <span class="flex items-center gap-2">
            Let's go!
            <span class="text-2xl group-hover:rotate-12 transition-transform">👋</span>
          </span>
        </button>
        <span class="text-sm text-slate-500 dark:text-slate-400">Free forever • No credit card</span>
      </div>

      <!-- App Preview -->
      <div class="w-full max-w-2xl">
        <div class="relative">
          <!-- Decorative elements around preview -->
          <div class="absolute -top-4 -left-4 w-8 h-8 bg-sky-400 rounded-lg rotate-12 shadow-lg"></div>
          <div class="absolute -bottom-3 -right-3 w-6 h-6 bg-emerald-400 rounded-full shadow-lg"></div>
          
          <!-- Preview Card -->
          <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-4 border-slate-800 dark:border-slate-600 overflow-hidden rotate-1 hover:rotate-0 transition-transform">
            <!-- Mock Header Bar -->
            <div class="flex items-center gap-3 px-5 py-4 bg-slate-800 dark:bg-slate-900">
              <div class="flex gap-2">
                <div class="w-3 h-3 rounded-full bg-rose-400"></div>
                <div class="w-3 h-3 rounded-full bg-amber-400"></div>
                <div class="w-3 h-3 rounded-full bg-emerald-400"></div>
              </div>
              <span class="text-white/60 text-sm font-medium">EZtodo</span>
            </div>
            
            <!-- Mock Content -->
            <div class="p-6 md:p-8">
              <!-- Greeting -->
              <div class="mb-6 flex items-center gap-3">
                <span class="text-3xl">👋</span>
                <div>
                  <h2 class="text-xl font-bold text-slate-800 dark:text-white">Hey there!</h2>
                  <p class="text-slate-500 dark:text-slate-400 text-sm">3 things to do today</p>
                </div>
              </div>
              
              <!-- Mock Tasks -->
              <div class="space-y-3">
                <!-- Completed Task -->
                <div class="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800">
                  <div class="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30">
                    <span class="material-symbols-outlined text-white text-base" style="font-variation-settings: 'wght' 600;">check</span>
                  </div>
                  <span class="text-emerald-700 dark:text-emerald-300 line-through font-medium">Drink coffee ☕</span>
                </div>
                
                <!-- Active Task -->
                <div class="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 shadow-md hover:shadow-lg transition-shadow">
                  <div class="w-6 h-6 rounded-lg border-2 border-rose-400 flex-shrink-0"></div>
                  <span class="text-slate-700 dark:text-slate-200 font-medium">Try this awesome app</span>
                  <span class="ml-auto text-lg">⭐</span>
                </div>
                
                <!-- Active Task -->
                <div class="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800">
                  <div class="w-6 h-6 rounded-lg border-2 border-amber-400 flex-shrink-0"></div>
                  <span class="text-slate-700 dark:text-slate-200 font-medium">Be amazing today</span>
                  <span class="ml-auto text-lg">💪</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Features Section -->
    <section class="relative z-10 px-6 py-20 md:py-28">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl md:text-4xl font-bold text-center text-slate-800 dark:text-white mb-4">
          Why you'll love it 💕
        </h2>
        <p class="text-slate-600 dark:text-slate-400 text-center mb-16 text-lg">
          (Besides the obvious good vibes)
        </p>
        
        <div class="grid md:grid-cols-3 gap-8">
          <!-- Feature 1 -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 hover:rotate-1">
            <div class="text-4xl mb-4">🔄</div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">Syncs magically</h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Phone, laptop, tablet — your tasks are everywhere you are.
            </p>
          </div>
          
          <!-- Feature 2 -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 hover:-rotate-1">
            <div class="text-4xl mb-4">✈️</div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">Works offline</h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              No wifi? No problem! Add tasks anytime, anywhere.
            </p>
          </div>
          
          <!-- Feature 3 -->
          <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 hover:rotate-1">
            <div class="text-4xl mb-4">🌙</div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">Dark mode</h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Easy on the eyes at 2am. We don't judge.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="relative z-10 px-6 py-20 md:py-28">
      <div class="max-w-2xl mx-auto">
        <div class="bg-slate-800 dark:bg-slate-950 rounded-3xl p-10 md:p-14 text-center shadow-2xl border-4 border-slate-700 -rotate-1 hover:rotate-0 transition-transform">
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to crush it? 💪
          </h2>
          <p class="text-slate-400 mb-8 text-lg">
            Your future organized self will thank you.
          </p>
          <button
            @click="$emit('getStarted')"
            class="px-8 py-4 bg-rose-500 hover:bg-rose-600 text-white text-lg font-bold rounded-2xl shadow-xl shadow-rose-500/30 transition-all hover:scale-105"
          >
            Start for free →
          </button>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="relative z-10 px-6 py-8 border-t border-slate-200 dark:border-slate-800">
      <div class="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center rotate-3">
            <span class="material-symbols-outlined text-white text-lg" style="font-variation-settings: 'FILL' 1;">task_alt</span>
          </div>
          <span class="font-bold text-slate-700 dark:text-slate-300">EZtodo</span>
        </div>
        <div class="flex items-center gap-4">
          <a 
            href="https://buymeacoffee.com/eztodoapp" 
            target="_blank" 
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-800 text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-all hover:scale-105"
          >
            <span class="text-lg">☕</span>
            Buy me a coffee
          </a>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Made with ☕ and good intentions
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>
